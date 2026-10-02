import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '../../src/adapters/fs/node-fs.js';
import { appendInstall, loadManifest, manifestPath, stateDir } from '../../src/application/journal.js';
import { ManifestError, type Install } from '../../src/domain/manifest.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const install = (id: string): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: [],
});

describe('journal', () => {
  let tmp: TmpPaths;
  const fs = new NodeFileSystem();
  beforeEach(async () => {
    tmp = await makeTmpPaths();
  });
  afterEach(() => tmp.cleanup());

  it('keeps the state under <home>/.claude/.dotagent', () => {
    expect(stateDir(tmp.homeDir)).toBe(`${tmp.homeDir}/.claude/.dotagent`);
    expect(manifestPath(tmp.homeDir)).toBe(`${tmp.homeDir}/.claude/.dotagent/manifest.json`);
  });

  it('loads an empty manifest when none exists, without creating it', async () => {
    expect(await loadManifest(fs, tmp.homeDir)).toEqual({ version: 1, installs: [] });
    expect(await fs.readText(manifestPath(tmp.homeDir))).toBeNull();
  });

  it('writes the manifest on the first install and appends afterwards', async () => {
    await appendInstall(fs, tmp.homeDir, install('a'));
    await appendInstall(fs, tmp.homeDir, install('b'));
    const saved = JSON.parse(await readFile(manifestPath(tmp.homeDir), 'utf8'));
    expect(saved.installs.map((i: Install) => i.id)).toEqual(['a', 'b']);
  });

  it('refuses to overwrite a corrupt manifest', async () => {
    await fs.writeAtomic(manifestPath(tmp.homeDir), '{ nope');
    await expect(appendInstall(fs, tmp.homeDir, install('a'))).rejects.toThrow(ManifestError);
    expect(await readFile(manifestPath(tmp.homeDir), 'utf8')).toBe('{ nope');
  });
});
