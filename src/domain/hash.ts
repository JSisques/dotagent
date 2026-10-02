import { createHash } from 'node:crypto';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** JSON with object keys sorted at every depth, so equal entries hash equally regardless of key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const body = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${body.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashEntry(entry: unknown): string {
  return sha256(canonicalJson(entry));
}

/**
 * Hash of a whole file tree: sha256 over entries sorted by path (code units) of `path NUL sha256(bytes) LF`.
 * Paths are POSIX and relative to the tree root. An empty tree has no hash.
 */
export function treeHash(files: readonly { path: string; bytes: Uint8Array }[]): string | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(sorted.map((f) => `${f.path}\0${sha256(f.bytes)}\n`).join(''));
}
