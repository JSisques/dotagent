import { chmod, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { UnsafeTreeError } from '@/ports/file-system.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

describe('NodeFileSystem', () => {
  let tmp: TmpPaths;
  const fs = new NodeFileSystem();
  beforeEach(async () => {
    tmp = await makeTmpPaths();
  });
  afterEach(() => tmp.cleanup());

  it('returns null for a missing file', async () => {
    expect(await fs.readText(join(tmp.cwd, 'nope.json'))).toBeNull();
  });

  it('creates parent directories and leaves no temp files', async () => {
    const file = join(tmp.cwd, 'a', 'b', 'x.json');
    await fs.writeAtomic(file, '{}\n');
    expect(await fs.readText(file)).toBe('{}\n');
    expect(await readdir(join(tmp.cwd, 'a', 'b'))).toEqual(['x.json']);
  });

  it('keeps the mode of an existing file', async () => {
    const file = join(tmp.cwd, 'x.json');
    await writeFile(file, 'old');
    await chmod(file, 0o600);
    await fs.writeAtomic(file, 'new');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, 'utf8')).toBe('new');
  });

  it('reports a failed rename, keeps the target intact and removes the temp file', async () => {
    const target = join(tmp.cwd, 'dir-target');
    await mkdir(target);
    await writeFile(join(target, 'keep'), 'data');
    await expect(fs.writeAtomic(target, 'x')).rejects.toThrow();
    expect(await readFile(join(target, 'keep'), 'utf8')).toBe('data');
    expect(await readdir(tmp.cwd)).toEqual(['dir-target']);
  });

  it('removes files and tolerates missing ones', async () => {
    const file = join(tmp.cwd, 'x.json');
    await writeFile(file, 'x');
    await fs.remove(file);
    await fs.remove(file);
    expect(await fs.readText(file)).toBeNull();
  });

  it('reads bytes and returns null for a missing file', async () => {
    const file = join(tmp.cwd, 'a.bin');
    await writeFile(file, new Uint8Array([0, 200, 1]));
    expect(Array.from((await fs.readBytes(file)) ?? [])).toEqual([0, 200, 1]);
    expect(await fs.readBytes(join(tmp.cwd, 'nope.bin'))).toBeNull();
  });

  it('lists regular files as sorted relative paths and null for a missing dir', async () => {
    await mkdir(join(tmp.cwd, 'd', 'sub'), { recursive: true });
    await writeFile(join(tmp.cwd, 'd', 'z.md'), 'z');
    await writeFile(join(tmp.cwd, 'd', 'sub', 'a.md'), 'a');
    expect(await fs.listFiles(join(tmp.cwd, 'd'))).toEqual(['sub/a.md', 'z.md']);
    expect(await fs.listFiles(join(tmp.cwd, 'missing'))).toBeNull();
  });

  it('refuses to list a tree that contains a symlink', async () => {
    await mkdir(join(tmp.cwd, 'd'));
    await writeFile(join(tmp.cwd, 'real.md'), 'r');
    await symlink(join(tmp.cwd, 'real.md'), join(tmp.cwd, 'd', 'link.md'));
    await expect(fs.listFiles(join(tmp.cwd, 'd'))).rejects.toThrow(UnsafeTreeError);
  });
});
