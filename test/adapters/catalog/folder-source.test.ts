import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const mcp = (name: string): object => ({
  name,
  description: `${name} mcp`,
  server: { type: 'stdio', command: 'npx', env: { KEY: '${KEY}' } },
  env: [{ name: 'KEY' }],
});

let tmp: TmpPaths;
let dir: string;

async function put(rel: string, data: unknown): Promise<void> {
  const file = join(dir, rel);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, typeof data === 'string' ? data : JSON.stringify(data));
}

beforeEach(async () => {
  tmp = await makeTmpPaths();
  dir = join(tmp.root, 'catalog');
});
afterEach(() => tmp.cleanup());

describe('FolderCatalogSource', () => {
  it('loads a custom folder and ignores reserved folders', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['github'], profiles: ['base'], skills: ['x'] } });
    await put('mcps/github.json', mcp('github'));
    await put('profiles/base.json', { name: 'base', mcps: ['github'] });
    await put('skills/x/SKILL.md', '# skill');

    const source = new FolderCatalogSource(dir, 'folder');
    const catalog = await source.load();
    expect(source.ref()).toEqual({ kind: 'folder', location: dir });
    expect(catalog.mcps.map((m) => m.name)).toEqual(['github']);
    expect(catalog.profiles.map((p) => p.name)).toEqual(['base']);
    expect(catalog.issues).toEqual([]);
  });

  it('fails clearly when the source is missing', async () => {
    await expect(new FolderCatalogSource(join(tmp.root, 'nope'), 'folder').load()).rejects.toThrow(/catalog\.json/);
  });

  it('skips an invalid item and reports its file and reason', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['good', 'bad'] } });
    await put('mcps/good.json', mcp('good'));
    await put('mcps/bad.json', { name: 'bad', description: 'no server' });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.mcps.map((m) => m.name)).toEqual(['good']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('mcps/bad.json');
    expect(catalog.issues[0]?.reason).toContain('server');
  });

  it('reports unparseable JSON and name mismatches', async () => {
    await put('catalog.json', { version: 1, items: { mcps: ['broken', 'other'] } });
    await put('mcps/broken.json', '{ nope');
    await put('mcps/other.json', mcp('different'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.mcps).toEqual([]);
    expect(catalog.issues.map((i) => i.file)).toEqual(['mcps/broken.json', 'mcps/other.json']);
  });

  it('drops profiles that reference unknown mcps', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], profiles: ['web'] } });
    await put('profiles/web.json', { name: 'web', mcps: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles).toEqual([]);
    expect(catalog.issues[0]?.reason).toContain('ghost');
  });
});
