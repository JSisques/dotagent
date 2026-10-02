import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCodeTarget } from '../../src/adapters/claude-code/target.js';
import { FolderCatalogSource } from '../../src/adapters/catalog/folder-source.js';
import { NodeFileSystem } from '../../src/adapters/fs/node-fs.js';
import { ConfigError } from '../../src/domain/json-merge.js';
import { initMcps, UnknownMcpError, type InitDeps } from '../../src/application/init-mcps.js';
import { makeTmpPaths, type TmpPaths } from '../helpers/tmp-paths.js';

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
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('merges into an existing file keeping unknown keys', async () => {
    await writeFile(mcpFile(), JSON.stringify({ theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } }));
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
