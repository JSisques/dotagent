import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const mcp = (name: string): object => ({
  name,
  description: `${name} mcp`,
  server: { type: 'stdio', command: 'npx', env: { KEY: '${KEY}' } },
  env: [{ name: 'KEY' }],
});

const skillMd = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}\n`;

let tmp: TmpPaths;
let dir: string;

async function put(rel: string, data: unknown): Promise<void> {
  const file = join(dir, rel);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data));
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
    await put('skills/x/SKILL.md', skillMd('x'));

    const source = new FolderCatalogSource(dir, 'folder');
    const catalog = await source.load();
    expect(source.ref()).toEqual({ kind: 'folder', location: dir });
    expect(catalog.mcps.map((m) => m.name)).toEqual(['github']);
    expect(catalog.profiles.map((p) => p.name)).toEqual(['base']);
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['x']);
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

  it('loads a skill with a binary file as bytes', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('skills/demo/assets/logo.bin', new Uint8Array([0, 255, 9]));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.skills).toHaveLength(1);
    const files = catalog.skills[0]?.files ?? [];
    expect(files.map((f) => f.path)).toEqual(['SKILL.md', 'assets/logo.bin']);
    expect(Array.from(files[1]?.bytes ?? [])).toEqual([0, 255, 9]);
  });

  it('skips an invalid skill, reports it, and keeps the valid ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['good', 'bad', 'mismatch'] } });
    await put('skills/good/SKILL.md', skillMd('good'));
    await put('skills/bad/SKILL.md', '# no frontmatter');
    await put('skills/mismatch/SKILL.md', skillMd('other'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['good']);
    expect(catalog.issues.map((i) => i.file)).toEqual(['skills/bad/SKILL.md', 'skills/mismatch']);
    expect(catalog.issues[1]?.reason).toContain("'other'");
  });

  it('skips a skill that contains a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['linked'] } });
    await put('skills/linked/SKILL.md', skillMd('linked'));
    await put('secret.txt', 'secret');
    await symlink(join(dir, 'secret.txt'), join(dir, 'skills', 'linked', 'leak.txt'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues[0]?.file).toBe('skills/linked');
    expect(catalog.issues[0]?.reason).toContain('leak.txt');
  });

  it('skips a skill whose directory is a symlink', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['jump'] } });
    await put('elsewhere/SKILL.md', skillMd('jump'));
    await mkdir(join(dir, 'skills'), { recursive: true });
    await symlink(join(dir, 'elsewhere'), join(dir, 'skills', 'jump'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues[0]?.reason).toContain('symbolic link');
  });

  it('flags a listed skill with no directory', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['ghost'] } });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/ghost');
    expect(catalog.issues[0]?.reason).toContain('missing');
  });

  it('flags a skill directory that is not listed in catalog.json', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['listed'] } });
    await put('skills/listed/SKILL.md', skillMd('listed'));
    await put('skills/stray/SKILL.md', skillMd('stray'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['listed']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/stray');
    expect(catalog.issues[0]?.reason).toContain('not listed');
  });

  it('fails the catalog naming a skill entry that could traverse paths', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['../evil'] } });
    await expect(new FolderCatalogSource(dir, 'folder').load()).rejects.toThrow(/\.\.\/evil/);
  });

  it('reports a missing description against skills/<name>/SKILL.md', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'] } });
    await put('skills/demo/SKILL.md', '---\nname: demo\n---\n# demo\n');

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills).toEqual([]);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/demo/SKILL.md');
    expect(catalog.issues[0]?.reason).toContain('description');
  });

  it.each([
    [
      'a file above the size limit',
      async () => put('skills/demo/big.bin', new Uint8Array(MAX_FILE_BYTES + 1)),
      'file size',
    ],
    [
      'more files than the file-count limit',
      async () => {
        for (let i = 0; i <= MAX_SKILL_FILES; i++) await put(`skills/demo/f${i}.txt`, 'x');
      },
      'file count',
    ],
    [
      'a tree deeper than the depth limit',
      async () => put(`skills/demo/${Array.from({ length: MAX_DEPTH + 1 }, () => 'd').join('/')}/f.txt`, 'x'),
      'depth',
    ],
    [
      'a skill above the total size limit',
      async () => {
        for (let i = 0; i < 6; i++) await put(`skills/demo/p${i}.bin`, new Uint8Array(MAX_FILE_BYTES));
      },
      'total size',
    ],
  ])('rejects a skill with %s, naming the limit', async (_title, build, reason) => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo', 'ok'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('skills/ok/SKILL.md', skillMd('ok'));
    await build();

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.skills.map((sk) => sk.name)).toEqual(['ok']);
    expect(catalog.issues).toHaveLength(1);
    expect(catalog.issues[0]?.file).toBe('skills/demo');
    expect(catalog.issues[0]?.reason).toContain(reason);
  });

  it('ignores non-directory entries in skills/ but flags unlisted directories', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['listed'] } });
    await put('skills/listed/SKILL.md', skillMd('listed'));
    await put('skills/.DS_Store', 'junk');
    await put('skills/README.md', '# skills');
    await put('skills/stray/SKILL.md', skillMd('stray'));

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.issues.map((i) => i.file)).toEqual(['skills/stray']);
  });

  it('resolves profile skills and drops profiles that reference unknown ones', async () => {
    await put('catalog.json', { version: 1, items: { mcps: [], skills: ['demo'], profiles: ['ok', 'broken'] } });
    await put('skills/demo/SKILL.md', skillMd('demo'));
    await put('profiles/ok.json', { name: 'ok', skills: ['demo'] });
    await put('profiles/broken.json', { name: 'broken', skills: ['ghost'] });

    const catalog = await new FolderCatalogSource(dir, 'folder').load();
    expect(catalog.profiles.map((p) => p.name)).toEqual(['ok']);
    expect(catalog.issues[0]?.reason).toContain('ghost');
  });
});
