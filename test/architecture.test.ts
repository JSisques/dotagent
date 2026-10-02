import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');
const TEST = join(import.meta.dirname, '..', 'test');

function listTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listTs(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

const rel = (f: string): string => relative(SRC, f).split('\\').join('/');
const files = listTs(SRC).map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }));
const testFiles = listTs(TEST).map((f) => ({
  path: `test/${relative(TEST, f).split('\\').join('/')}`,
  text: readFileSync(f, 'utf8'),
}));

/** Module specifiers from `from '...'`, `import('...')` and side-effect `import '...'` only. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
const specifiers = (text: string): string[] => [...text.matchAll(SPECIFIER)].map((m) => m[1] ?? '');
const importing = (all: { path: string; text: string }[], prefix: string): string[] =>
  all.filter((f) => specifiers(f.text).some((s) => s.startsWith(prefix))).map((f) => f.path);

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

  it('scans test files as well', () => {
    expect(testFiles.some((f) => f.path === 'test/architecture.test.ts')).toBe(true);
  });

  it('never imports @test/ from src', () => {
    expect(importing(files, '@test/')).toEqual([]);
  });

  it('keeps src/domain free of @/adapters and @/application', () => {
    const domain = files.filter((f) => f.path.startsWith('domain/'));
    expect([...importing(domain, '@/adapters'), ...importing(domain, '@/application')]).toEqual([]);
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
