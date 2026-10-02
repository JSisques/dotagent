import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function listTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listTs(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

const rel = (f: string): string => relative(SRC, f).split('\\').join('/');
const files = listTs(SRC).map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }));

describe('architecture guards', () => {
  it('finds source files to scan', () => {
    expect(files.some((f) => f.path === 'main.ts')).toBe(true);
  });

  it('keeps src/domain free of fs, os, path and process', () => {
    const forbidden = /from\s+['"](node:)?(fs|fs\/promises|os|path|child_process)['"]|\bprocess\./;
    const offenders = files.filter((f) => f.path.startsWith('domain/') && forbidden.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('references homedir only in main.ts', () => {
    const offenders = files.filter((f) => f.path !== 'main.ts' && /\bhomedir\b/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe('test isolation', () => {
  it('makes real home access fail', () => {
    expect(() => homedir()).toThrow(/forbidden/);
  });

  it('points HOME at a temp dir', () => {
    expect(process.env['HOME']).toContain('dotagent-home-');
  });
});
