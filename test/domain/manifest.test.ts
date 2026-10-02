import { describe, expect, it } from 'vitest';
import {
  deriveOwnership,
  emptyManifest,
  ManifestError,
  parseManifest,
  type Install,
  type Manifest,
} from '../../src/domain/manifest.js';

const install = (id: string, name: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: [
    {
      path: '/p/.mcp.json',
      scope: 'project',
      backup: null,
      beforeHash: null,
      afterHash: 'after',
      items: [{ kind: 'mcp', name, action: 'create', entryHash }],
    },
  ],
  ...over,
});

const manifest = (installs: Install[]): Manifest => ({ version: 1, installs });

describe('deriveOwnership', () => {
  it('is empty for an empty manifest', () => {
    expect(deriveOwnership(emptyManifest())).toEqual({});
  });

  it('maps each file and entry name to its installed hash', () => {
    expect(deriveOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({ '/p/.mcp.json': { github: 'h1' } });
  });

  it('lets a later install replace the hash of an earlier one', () => {
    const owned = deriveOwnership(manifest([install('a', 'github', 'h1'), install('b', 'github', 'h2')]));
    expect(owned['/p/.mcp.json']?.github).toBe('h2');
  });

  it('ignores undone installs', () => {
    const undone = install('b', 'github', 'h2', { undoneAt: '2026-10-03T00:00:00.000Z' });
    expect(deriveOwnership(manifest([install('a', 'github', 'h1'), undone]))['/p/.mcp.json']?.github).toBe('h1');
    expect(deriveOwnership(manifest([undone]))).toEqual({});
  });
});

describe('parseManifest', () => {
  it('round-trips a valid manifest', () => {
    const m = manifest([install('a', 'github', 'h1')]);
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
  });

  it('rejects invalid JSON and wrong shapes with ManifestError', () => {
    expect(() => parseManifest('{ nope')).toThrow(ManifestError);
    expect(() => parseManifest('{"version":2,"installs":[]}')).toThrow(ManifestError);
  });
});
