import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
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
  UnknownSkillError,
  type InitDeps,
} from '@/application/init-mcps.js';
import { appendInstall, manifestPath, stateDir } from '@/application/journal.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import { hashEntry, sha256, treeHash } from '@/domain/hash.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { UnsafeTreeError } from '@/ports/file-system.js';
import { parseManifest, type Manifest } from '@/domain/manifest.js';
import { parseDoc } from '@test/helpers/parse-doc.js';
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
    expect(parseDoc(text).mcpServers.github?.headers?.Authorization).toBe('Bearer ${GITHUB_TOKEN}');
    expect(text).not.toContain('abc123');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude']);
  });

  it('merges into an existing file keeping unknown keys', async () => {
    await writeFile(
      mcpFile(),
      JSON.stringify({ theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } }),
    );
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    const doc = parseDoc(await readFile(mcpFile(), 'utf8'));
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
    expect(parseDoc(await readFile(mcpFile(), 'utf8')).mcpServers.github?.type).toBe('http');
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
  const manifest = async (): Promise<Manifest> => parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are typed any
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
    const doc = parseDoc(await readFile(mcpFile(), 'utf8'));
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

  it('updates an entry shitaku owns but protects an unmanaged one', async () => {
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
      createdDirs: [],
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
    const doc = parseDoc(await readFile(userFile(), 'utf8'));
    expect(doc).toMatchObject({
      projects: { a: 1 },
      theme: 'dark',
      mcpServers: { other: { command: 'x' }, github: { type: 'http' } },
    });
    const manifest = parseManifest(await readFile(manifestPath(tmp.homeDir), 'utf8'));
    const file = manifest.installs[0]!.files[0]!;
    expect(file.scope).toBe('user');
    expect(await readFile(join(stateDir(tmp.homeDir), file.backup!), 'utf8')).toBe(original);
  });

  it('creates a missing ~/.claude.json containing only mcpServers', async () => {
    await initMcps(deps, { mcps: ['context7'], scope: 'user' });
    expect(Object.keys(parseDoc(await readFile(userFile(), 'utf8')))).toEqual(['mcpServers']);
  });

  it('aborts on a corrupt ~/.claude.json leaving it byte-identical and the manifest absent', async () => {
    await writeFile(userFile(), '{ nope');
    await expect(initMcps(deps, { mcps: ['github'], scope: 'user' })).rejects.toThrow(ConfigError);
    expect(await readFile(userFile(), 'utf8')).toBe('{ nope');
    expect(await readdir(tmp.homeDir)).toEqual(['.claude.json']);
  });
});

describe('planInit (skills)', () => {
  const enc = (text: string) => new TextEncoder().encode(text);
  const v1: SkillItem = {
    name: 'demo',
    description: 'd',
    files: [
      { path: 'SKILL.md', bytes: enc('one') },
      { path: 'notes.md', bytes: enc('n') },
    ],
  };
  const v2: SkillItem = { ...v1, files: [{ path: 'SKILL.md', bytes: enc('two') }] };
  const source = (skills: SkillItem[]): CatalogSource => ({
    ref: () => ({ kind: 'bundled', location: '/catalog' }),
    load: () => Promise.resolve({ mcps: [], skills, profiles: [], issues: [] }),
  });

  let tmp: TmpPaths;
  let deps: InitDeps;
  const userRoot = () => join(tmp.homeDir, '.claude', 'skills', 'demo');
  const projectRoot = () => join(tmp.cwd, '.claude', 'skills', 'demo');
  const put = async (root: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), text);
    }
  };
  const seedOwnership = (root: string, item: SkillItem) =>
    appendInstall(deps.fs, tmp.homeDir, {
      id: 'seed',
      createdAt: '2026-10-02T00:00:00.000Z',
      undoneAt: null,
      source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
      files: item.files.map((f) => ({
        path: join(root, f.path),
        scope: 'user' as const,
        backup: null,
        beforeHash: null,
        afterHash: sha256(f.bytes),
        items: [
          {
            kind: 'skill' as const,
            name: item.name,
            action: 'create' as const,
            entryHash: treeHash(item.files) ?? '',
            root,
          },
        ],
      })),
      createdDirs: [],
    });
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: source([v2]),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('plans a create under ~/.claude/skills for user scope and plans no MCP file', async () => {
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.files).toEqual([]);
    expect(plan.skills).toHaveLength(1);
    expect(plan.skills[0]).toMatchObject({ name: 'demo', root: userRoot(), action: 'create', presentHash: null });
  });

  it('plans under ./.claude/skills for project scope', async () => {
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' });
    expect(plan.skills[0]?.root).toBe(projectRoot());
  });

  it('plans MCPs and skills together, leaving the skills empty when none are requested', async () => {
    deps = { ...deps, source: new FolderCatalogSource(CATALOG, 'bundled') };
    const both = await planInit(deps, { mcps: ['github'], skills: ['example-skill'], scope: 'project' });
    expect(both.files).toHaveLength(1);
    expect(both.skills.map((s) => s.name)).toEqual(['example-skill']);
    expect((await planInit(deps, { mcps: ['github'], scope: 'project' })).skills).toEqual([]);
  });

  it('skips an identical tree on disk', async () => {
    await put(projectRoot(), { 'SKILL.md': 'two' });
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' });
    expect(plan.skills[0]).toMatchObject({ action: 'skip', reason: 'already installed' });
  });

  it('plans an update of an owned tree and lists the dropped file', async () => {
    await put(userRoot(), { 'SKILL.md': 'one', 'notes.md': 'n' });
    await seedOwnership(userRoot(), v1);
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.skills[0]).toMatchObject({ action: 'update', removed: ['notes.md'] });
    expect(plan.skills[0]?.present.map((f) => f.path)).toEqual(['SKILL.md', 'notes.md']);
  });

  it('plans a conflict for an owned tree modified since the install', async () => {
    await put(userRoot(), { 'SKILL.md': 'one', 'notes.md': 'edited' });
    await seedOwnership(userRoot(), v1);
    const plan = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'user' });
    expect(plan.skills[0]?.action).toBe('conflict');
  });

  it('plans a conflict for an unowned tree and a forced update with --force', async () => {
    await put(projectRoot(), { 'SKILL.md': 'mine' });
    expect((await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).skills[0]?.action).toBe('conflict');
    const forced = await planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force: true });
    expect(forced.skills[0]).toMatchObject({ action: 'update', reason: 'replaced by --force' });
  });

  it('rejects an unknown skill name', async () => {
    await expect(planInit(deps, { mcps: [], skills: ['demo', 'nope'], scope: 'user' })).rejects.toThrow(
      UnknownSkillError,
    );
    await expect(planInit(deps, { mcps: [], skills: ['nope'], scope: 'user' })).rejects.toThrow('unknown skill: nope');
  });

  it('fails planning when the skill directory is a symlink, even with --force', async () => {
    await mkdir(join(projectRoot(), '..'), { recursive: true });
    await mkdir(join(tmp.root, 'elsewhere'));
    await symlink(join(tmp.root, 'elsewhere'), projectRoot());
    for (const force of [false, true]) {
      await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force })).rejects.toThrow(
        UnsafeTreeError,
      );
    }
  });

  it('fails planning when the target holds a symlink inside the skill', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    await symlink(join(tmp.root, 'nowhere'), join(projectRoot(), 'link.md'));
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project', force: true })).rejects.toThrow(
      UnsafeTreeError,
    );
  });

  it('plans each skill once when the request repeats a name, keeping first-occurrence order', async () => {
    const other: SkillItem = { ...v1, name: 'other' };
    deps = { ...deps, source: source([v2, other]) };
    const plan = await planInit(deps, { mcps: [], skills: ['demo', 'other', 'demo'], scope: 'user' });
    expect(plan.skills.map((s) => s.root)).toEqual([userRoot(), join(tmp.homeDir, '.claude', 'skills', 'other')]);
  });

  it('fails planning when a listed file vanishes before it is read', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    const fs = new NodeFileSystem();
    deps = {
      ...deps,
      fs: Object.assign(Object.create(fs) as NodeFileSystem, {
        listFiles: async (dir: string) => [...((await fs.listFiles(dir)) ?? []), 'gone.md'],
      }),
    };
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).rejects.toThrow(UnsafeTreeError);
  });

  it('fails planning when a listed file is swapped for a symlink before it is read', async () => {
    await put(projectRoot(), { 'SKILL.md': 'x' });
    await writeFile(join(tmp.root, 'secret'), 'secret');
    const fs = new NodeFileSystem();
    deps = {
      ...deps,
      fs: Object.assign(Object.create(fs) as NodeFileSystem, {
        listFiles: async (dir: string) => {
          const listed = await fs.listFiles(dir);
          await rm(join(projectRoot(), 'SKILL.md'));
          await symlink(join(tmp.root, 'secret'), join(projectRoot(), 'SKILL.md'));
          return listed;
        },
      }),
    };
    await expect(planInit(deps, { mcps: [], skills: ['demo'], scope: 'project' })).rejects.toThrow(UnsafeTreeError);
  });
});
