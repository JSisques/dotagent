import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { ConfigError } from '@/domain/json-merge.js';
import {
  applyPlan,
  initMcps,
  LeakError,
  planInit,
  StaleFileError,
  UnknownMcpError,
  type InitDeps,
} from '@/application/init-mcps.js';
import { appendInstall, manifestPath, stateDir } from '@/application/journal.js';
import { hashEntry, sha256 } from '@/domain/hash.js';
import type { Manifest } from '@/domain/manifest.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', 'catalog');

describe('initMcps (project scope)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('creates ./.mcp.json with the entry and no env value', async () => {
    const { applied } = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(applied).toBe(true);
    const text = await readFile(mcpFile(), 'utf8');
    expect(JSON.parse(text).mcpServers.github.headers.Authorization).toBe('Bearer ${GITHUB_TOKEN}');
    expect(text).not.toContain('abc123');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude']);
  });

  it('merges into an existing file keeping unknown keys', async () => {
    await writeFile(
      mcpFile(),
      JSON.stringify({ theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } }),
    );
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    const doc = JSON.parse(await readFile(mcpFile(), 'utf8'));
    expect(doc.theme).toBe('dark');
    expect(Object.keys(doc.mcpServers)).toEqual(['other', 'context7']);
  });

  it('writes nothing on dry run', async () => {
    const { plan, applied } = await initMcps(deps, { mcps: ['github'], scope: 'project', dryRun: true });
    expect(applied).toBe(false);
    expect(plan.files[0]?.items[0]?.action).toBe('create');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('does not write when everything is identical', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const before = await readFile(mcpFile(), 'utf8');
    const { applied } = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(applied).toBe(false);
    expect(await readFile(mcpFile(), 'utf8')).toBe(before);
  });

  it('leaves a conflicting entry untouched unless forced', async () => {
    const original = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    await writeFile(mcpFile(), original);
    const first = await initMcps(deps, { mcps: ['github'], scope: 'project' });
    expect(first.applied).toBe(false);
    expect(first.plan.files[0]?.items[0]?.action).toBe('conflict');
    expect(await readFile(mcpFile(), 'utf8')).toBe(original);
    const forced = await initMcps(deps, { mcps: ['github'], scope: 'project', force: true });
    expect(forced.applied).toBe(true);
    expect(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers.github.type).toBe('http');
  });

  it('rejects an unknown MCP naming it, writing nothing', async () => {
    await expect(initMcps(deps, { mcps: ['github', 'ghost'], scope: 'project' })).rejects.toThrow(UnknownMcpError);
    await expect(initMcps(deps, { mcps: ['ghost'], scope: 'project' })).rejects.toThrow(/ghost/);
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('aborts on a corrupt file leaving it byte-identical', async () => {
    await writeFile(mcpFile(), '{ nope');
    await expect(initMcps(deps, { mcps: ['github'], scope: 'project' })).rejects.toThrow(ConfigError);
    expect(await readFile(mcpFile(), 'utf8')).toBe('{ nope');
  });
});

describe('initMcps safety (backup, re-read, leak scan, manifest)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const manifest = async (): Promise<Manifest> => JSON.parse(await readFile(manifestPath(tmp.homeDir), 'utf8'));
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('backs up the original bytes before changing the file and records the manifest', async () => {
    const original = JSON.stringify({ theme: 'dark' }, null, 4);
    await writeFile(mcpFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const file = (await manifest()).installs[0]!.files[0]!;
    expect(await readFile(join(stateDir(tmp.homeDir), file.backup!), 'utf8')).toBe(original);
    expect(file).toMatchObject({
      path: mcpFile(),
      scope: 'project',
      beforeHash: sha256(original),
      afterHash: sha256(await readFile(mcpFile(), 'utf8')),
    });
    expect(file.items).toEqual([
      { kind: 'mcp', name: 'github', action: 'create', entryHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    ]);
  });

  it('records no backup when the file did not exist', async () => {
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    expect((await manifest()).installs[0]!.files[0]).toMatchObject({ backup: null, beforeHash: null });
  });

  it('keeps a key written by another process between plan and apply', async () => {
    await writeFile(mcpFile(), JSON.stringify({ theme: 'dark' }));
    const plan = await planInit(deps, { mcps: ['github'], scope: 'project' });
    await writeFile(mcpFile(), JSON.stringify({ theme: 'dark', fresh: 1 }));
    await applyPlan(deps, plan);
    const doc = JSON.parse(await readFile(mcpFile(), 'utf8'));
    expect(doc).toMatchObject({ theme: 'dark', fresh: 1, mcpServers: { github: { type: 'http' } } });
  });

  it('aborts when the re-read changes what the plan would do', async () => {
    const plan = await planInit(deps, { mcps: ['github'], scope: 'project' });
    const other = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    await writeFile(mcpFile(), other);
    await expect(applyPlan(deps, plan)).rejects.toThrow(StaleFileError);
    expect(await readFile(mcpFile(), 'utf8')).toBe(other);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('writes placeholders only: no env value reaches any file under the temp root', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    for (const path of [mcpFile(), manifestPath(tmp.homeDir)])
      expect(await readFile(path, 'utf8')).not.toContain('abc123');
  });

  it('aborts before writing when an env value appears in the output', async () => {
    const leaky = { ...deps, env: { GITHUB_TOKEN: 'https://api.githubcopilot.com' } };
    await expect(initMcps(leaky, { mcps: ['github'], scope: 'project' })).rejects.toThrow(LeakError);
    expect(await readdir(tmp.cwd)).toEqual([]);
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('updates an entry dotagent owns but protects an unmanaged one', async () => {
    const stale = { type: 'stdio', command: 'old' };
    await writeFile(mcpFile(), JSON.stringify({ mcpServers: { github: stale } }));
    const unmanaged = await planInit(deps, { mcps: ['github'], scope: 'project' });
    expect(unmanaged.files[0]?.items[0]?.action).toBe('conflict');
    await appendInstall(deps.fs, tmp.homeDir, {
      id: 'seed',
      createdAt: '2026-10-02T00:00:00.000Z',
      undoneAt: null,
      source: { kind: 'bundled', location: CATALOG, catalogVersion: 1 },
      files: [
        {
          path: mcpFile(),
          scope: 'project',
          backup: null,
          beforeHash: null,
          afterHash: 'x',
          items: [{ kind: 'mcp', name: 'github', action: 'create', entryHash: hashEntry(stale) }],
        },
      ],
    });
    const owned = await planInit(deps, { mcps: ['github'], scope: 'project' });
    expect(owned.files[0]?.items[0]?.action).toBe('update');
  });
});

describe('initMcps (user scope)', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const userFile = () => join(tmp.homeDir, '.claude.json');
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: { GITHUB_TOKEN: 'abc123' },
    };
  });
  afterEach(() => tmp.cleanup());

  it('adds the entry to ~/.claude.json keeping every other key, with a byte-identical backup', async () => {
    const original = JSON.stringify(
      { projects: { a: 1 }, theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } },
      null,
      2,
    );
    await writeFile(userFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'user' });
    const doc = JSON.parse(await readFile(userFile(), 'utf8'));
    expect(doc).toMatchObject({
      projects: { a: 1 },
      theme: 'dark',
      mcpServers: { other: { command: 'x' }, github: { type: 'http' } },
    });
    const manifest = JSON.parse(await readFile(manifestPath(tmp.homeDir), 'utf8'));
    const file = manifest.installs[0].files[0];
    expect(file.scope).toBe('user');
    expect(await readFile(join(stateDir(tmp.homeDir), file.backup), 'utf8')).toBe(original);
  });

  it('creates a missing ~/.claude.json containing only mcpServers', async () => {
    await initMcps(deps, { mcps: ['context7'], scope: 'user' });
    expect(Object.keys(JSON.parse(await readFile(userFile(), 'utf8')))).toEqual(['mcpServers']);
  });

  it('aborts on a corrupt ~/.claude.json leaving it byte-identical and the manifest absent', async () => {
    await writeFile(userFile(), '{ nope');
    await expect(initMcps(deps, { mcps: ['github'], scope: 'user' })).rejects.toThrow(ConfigError);
    expect(await readFile(userFile(), 'utf8')).toBe('{ nope');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude.json']);
  });
});
