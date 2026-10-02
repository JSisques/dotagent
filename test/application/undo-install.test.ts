import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '../../src/adapters/catalog/folder-source.js';
import { claudeCodeTarget } from '../../src/adapters/claude-code/target.js';
import { NodeFileSystem } from '../../src/adapters/fs/node-fs.js';
import { initMcps, type InitDeps } from '../../src/application/init-mcps.js';
import { loadManifest, manifestPath } from '../../src/application/journal.js';
import { UndoSelectionError, undoInstall } from '../../src/application/undo-install.js';
import { makeTmpPaths, type TmpPaths } from '../helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', 'catalog');

describe('undoInstall', () => {
  let tmp: TmpPaths;
  let deps: InitDeps;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const userFile = () => join(tmp.homeDir, '.claude.json');
  const read = (path: string) => readFile(path, 'utf8');
  const undoDeps = () => ({ fs: deps.fs, paths: deps.paths });
  beforeEach(async () => {
    tmp = await makeTmpPaths();
    deps = {
      source: new FolderCatalogSource(CATALOG, 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env: {},
    };
  });
  afterEach(() => tmp.cleanup());

  it('restores the original bytes of a project file and marks the install undone', async () => {
    const original = `{\n    "theme": "dark",\n    "mcpServers": {}\n}\n`;
    await writeFile(mcpFile(), original);
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const result = await undoInstall(undoDeps(), {});
    expect(result).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await read(mcpFile())).toBe(original);
    const manifest = await loadManifest(deps.fs, tmp.homeDir);
    expect(manifest.installs[0]?.undoneAt).not.toBeNull();
  });

  it('removes a file the install created', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    await undoInstall(undoDeps(), {});
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('round-trips user scope back to the original bytes', async () => {
    const original = JSON.stringify(
      { numStartups: 7, mcpServers: { other: { type: 'stdio', command: 'x' } } },
      null,
      2,
    );
    await writeFile(userFile(), original);
    await initMcps(deps, { mcps: ['context7'], scope: 'user' });
    expect(await read(userFile())).not.toBe(original);
    await undoInstall(undoDeps(), {});
    expect(await read(userFile())).toBe(original);
  });

  it('refuses with exit code 3 when the file changed since install, unless forced', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const edited = (await read(mcpFile())).replace('github', 'github2');
    await writeFile(mcpFile(), edited);
    const refused = await undoInstall(undoDeps(), {});
    expect(refused).toMatchObject({ status: 'refused', exitCode: 3 });
    expect(refused.changed).toEqual([mcpFile()]);
    expect(await read(mcpFile())).toBe(edited);
    expect((await loadManifest(deps.fs, tmp.homeDir)).installs[0]?.undoneAt).toBeNull();

    const forced = await undoInstall(undoDeps(), { force: true });
    expect(forced).toMatchObject({ status: 'undone', exitCode: 0 });
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('reports nothing to undo without a manifest and changes nothing', async () => {
    const result = await undoInstall(undoDeps(), {});
    expect(result).toMatchObject({ status: 'nothing', exitCode: 0 });
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('only lets the newest install of a file be undone (LIFO)', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    await initMcps(deps, { mcps: ['context7'], scope: 'project' });
    const [first, second] = (await loadManifest(deps.fs, tmp.homeDir)).installs;
    const afterBoth = await read(mcpFile());
    await expect(undoInstall(undoDeps(), { id: first!.id })).rejects.toThrow(UndoSelectionError);
    expect(await read(mcpFile())).toBe(afterBoth);

    expect((await undoInstall(undoDeps(), {})).installId).toBe(second!.id);
    expect((await undoInstall(undoDeps(), { id: first!.id })).status).toBe('undone');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('writes nothing on dry run', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const file = await read(mcpFile());
    const manifest = await read(manifestPath(tmp.homeDir));
    const result = await undoInstall(undoDeps(), { dryRun: true });
    expect(result).toMatchObject({ status: 'dry-run', exitCode: 0, files: [mcpFile()] });
    expect(await read(mcpFile())).toBe(file);
    expect(await read(manifestPath(tmp.homeDir))).toBe(manifest);
  });

  it('treats a repeated undo as a no-op and rejects unknown ids', async () => {
    await initMcps(deps, { mcps: ['github'], scope: 'project' });
    const { installId } = await undoInstall(undoDeps(), {});
    expect(await undoInstall(undoDeps(), {})).toMatchObject({ status: 'nothing' });
    expect(await undoInstall(undoDeps(), { id: installId })).toMatchObject({ status: 'already-undone', exitCode: 0 });
    await expect(undoInstall(undoDeps(), { id: 'nope' })).rejects.toThrow(UndoSelectionError);
  });
});
