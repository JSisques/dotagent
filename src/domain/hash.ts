import { createHash } from 'node:crypto';

export function sha256(data: string): string {
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
