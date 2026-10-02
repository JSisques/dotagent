import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import type { SkillFile } from '@/domain/catalog/skill.js';
import { UnsafeTreeError } from '@/ports/file-system.js';

interface Entry {
  rel: string;
  abs: string;
  size: number;
}

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** Rejects a relative path with a `..` segment, a backslash, a NUL byte, or one that is empty or absolute. */
export function assertSafeRelPath(rel: string): void {
  const unsafe = rel === '' || rel.startsWith('/') || /[\\\0]/.test(rel) || rel.split('/').includes('..');
  if (unsafe) throw new UnsafeTreeError(`unsafe path: ${JSON.stringify(rel)}`);
}

/** Walks `root` with lstat only. Missing root resolves to null; anything unsafe or over the limits rejects. */
async function scan(root: string): Promise<Entry[] | null> {
  try {
    const top = await lstat(root);
    if (top.isSymbolicLink()) throw new UnsafeTreeError(`${root} is a symbolic link`);
    if (!top.isDirectory()) throw new UnsafeTreeError(`${root} is not a directory`);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }

  const entries: Entry[] = [];
  let total = 0;
  const visit = async (dir: string, prefix: string, depth: number): Promise<void> => {
    for (const name of (await readdir(dir)).sort()) {
      const rel = prefix === '' ? name : `${prefix}/${name}`;
      assertSafeRelPath(rel);
      const abs = join(dir, name);
      const info = await lstat(abs);
      if (info.isSymbolicLink()) throw new UnsafeTreeError(`symbolic link not allowed: ${rel}`);
      if (info.isDirectory()) {
        if (depth + 1 > MAX_DEPTH) throw new UnsafeTreeError(`depth above ${MAX_DEPTH}: ${rel}`);
        await visit(abs, rel, depth + 1);
      } else if (info.isFile()) {
        if (info.size > MAX_FILE_BYTES) throw new UnsafeTreeError(`file size above ${MAX_FILE_BYTES} bytes: ${rel}`);
        total += info.size;
        if (total > MAX_SKILL_BYTES) throw new UnsafeTreeError(`total size above ${MAX_SKILL_BYTES} bytes`);
        entries.push({ rel, abs, size: info.size });
        if (entries.length > MAX_SKILL_FILES) throw new UnsafeTreeError(`file count above ${MAX_SKILL_FILES}`);
      } else {
        throw new UnsafeTreeError(`special file not allowed: ${rel}`);
      }
    }
  };
  await visit(root, '', 0);
  return entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

export async function listTree(root: string): Promise<string[] | null> {
  return (await scan(root))?.map((e) => e.rel) ?? null;
}

/**
 * Reads every file of a tree as bytes. When `expectedReal` is given, the real path of `root` must equal it, so a
 * symlinked parent cannot redirect the read outside the catalog. Size is re-checked on the bytes actually read.
 */
export async function readTree(root: string, expectedReal?: string): Promise<SkillFile[] | null> {
  const entries = await scan(root);
  if (entries === null) return null;
  if (expectedReal !== undefined && (await realpath(root)) !== expectedReal) {
    throw new UnsafeTreeError(`${root} resolves outside ${expectedReal}`);
  }
  const files: SkillFile[] = [];
  for (const e of entries) {
    const bytes = new Uint8Array(await readFile(e.abs));
    if (bytes.length > MAX_FILE_BYTES) throw new UnsafeTreeError(`file size above ${MAX_FILE_BYTES} bytes: ${e.rel}`);
    files.push({ path: e.rel, bytes });
  }
  return files;
}
