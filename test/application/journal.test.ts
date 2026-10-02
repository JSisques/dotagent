import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { appendInstall, loadManifest, manifestPath, stateDir } from '@/application/journal.js';
import { ManifestError, type Install } from '@/domain/manifest.js';
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

  it('keeps the state under <home>/.claude/.shitaku', () => {
    expect(stateDir(tmp.homeDir)).toBe(`${tmp.homeDir}/.claude/.shitaku`);
    expect(manifestPath(tmp.homeDir)).toBe(`${tmp.homeDir}/.claude/.shitaku/manifest.json`);
  });

  it('loads an empty manifest when none exists, without creating it', async () => {
    expect(await loadManifest(fs, tmp.homeDir)).toEqual({ version: 1, installs: [] });
    expect(await fs.readText(manifestPath(tmp.homeDir))).toBeNull();
  });

  it('ignores a legacy state directory and leaves it untouched', async () => {
    // Built from parts so the naming guard does not flag this file.
    const legacyManifest = `${tmp.homeDir}/.claude/.${['dot', 'agent'].join('')}/manifest.json`;
    const legacyText = JSON.stringify({ version: 1, installs: [install('legacy')] });
    await fs.writeAtomic(legacyManifest, legacyText);

    expect(await loadManifest(fs, tmp.homeDir)).toEqual({ version: 1, installs: [] });
    await appendInstall(fs, tmp.homeDir, install('a'));

    const saved = JSON.parse(await readFile(manifestPath(tmp.homeDir), 'utf8'));
    expect(saved.installs.map((i: Install) => i.id)).toEqual(['a']);
    expect(await readFile(legacyManifest, 'utf8')).toBe(legacyText);
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
