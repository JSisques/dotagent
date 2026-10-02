import { describe, expect, it } from 'vitest';
import {
  deriveOwnership,
  deriveSkillOwnership,
  emptyManifest,
  ManifestError,
  parseManifest,
  type Install,
  type Manifest,
} from '@/domain/manifest.js';

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
  createdDirs: [],
  ...over,
});

const skillInstall = (id: string, root: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: ['SKILL.md', 'notes.md'].map((f) => ({
    path: `${root}/${f}`,
    scope: 'user' as const,
    backup: null,
    beforeHash: null,
    afterHash: 'h',
    items: [{ kind: 'skill' as const, name: root.split('/').pop() ?? '', action: 'create' as const, entryHash, root }],
  })),
  createdDirs: [root],
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

describe('deriveOwnership with skill items', () => {
  it('ignores skill items so file-keyed MCP ownership stays untouched', () => {
    expect(deriveOwnership(manifest([skillInstall('a', '/h/.claude/skills/demo', 'tree1')]))).toEqual({});
  });
});

describe('deriveSkillOwnership', () => {
  const root = '/h/.claude/skills/demo';

  it('is empty for an empty manifest or one with only MCP items', () => {
    expect(deriveSkillOwnership(emptyManifest())).toEqual({});
    expect(deriveSkillOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({});
  });

  it('maps each skill root to its installed tree hash', () => {
    expect(deriveSkillOwnership(manifest([skillInstall('a', root, 'tree1')]))).toEqual({ [root]: 'tree1' });
  });

  it('lets a later install replace the hash and ignores undone installs', () => {
    const undone = skillInstall('c', root, 'tree3', { undoneAt: '2026-10-03T00:00:00.000Z' });
    const owned = deriveSkillOwnership(
      manifest([skillInstall('a', root, 'tree1'), skillInstall('b', root, 'tree2'), undone]),
    );
    expect(owned).toEqual({ [root]: 'tree2' });
  });
});

describe('parseManifest', () => {
  it('parses a literal manifest JSON written before skills existed', () => {
    const text = `{"version":1,"installs":[{"id":"20260101T000000-ab12","createdAt":"2026-01-01T00:00:00.000Z",
      "undoneAt":null,"source":{"kind":"bundled","location":"/c","catalogVersion":1},
      "files":[{"path":"/p/.mcp.json","scope":"project","backup":null,"beforeHash":null,"afterHash":"h",
      "items":[{"kind":"mcp","name":"github","action":"create","entryHash":"e"}]}]}]}`;
    const parsed = parseManifest(text);
    expect(parsed.installs[0]?.createdDirs).toEqual([]);
    expect(deriveOwnership(parsed)).toEqual({ '/p/.mcp.json': { github: 'e' } });
  });

  it('rejects a null afterHash on an MCP file but accepts it on a skill file', () => {
    const base = install('a', 'github', 'h1');
    const file = { ...base.files[0]!, afterHash: null };
    expect(() => parseManifest(JSON.stringify(manifest([{ ...base, files: [file] }])))).toThrow(ManifestError);
    const skill = skillInstall('b', '/h/.claude/skills/demo', 'th');
    const dropped = { ...skill, files: skill.files.map((f) => ({ ...f, afterHash: null })) };
    expect(parseManifest(JSON.stringify(manifest([dropped]))).installs[0]?.files[0]?.afterHash).toBeNull();
  });

  it('parses a manifest written before skills existed, defaulting createdDirs to []', () => {
    const old = { ...install('a', 'github', 'h1'), createdDirs: undefined };
    const parsed = parseManifest(JSON.stringify({ version: 1, installs: [old] }));
    expect(parsed.installs[0]?.createdDirs).toEqual([]);
  });

  it('round-trips a skill install with a null afterHash for a removed file', () => {
    const base = skillInstall('a', '/h/.claude/skills/demo', 'tree1');
    const removed = {
      ...base.files[0]!,
      path: '/h/.claude/skills/demo/old.md',
      backup: 'backups/a/0-old.md',
      beforeHash: 'x',
      afterHash: null,
    };
    const m = manifest([{ ...base, files: [...base.files, removed] }]);
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
  });

  it('rejects a skill item without a root', () => {
    const m = manifest([skillInstall('a', '/r', 'h')]);
    const text = JSON.stringify(m)
      .replace(/"root":"[^"]*",?/g, '')
      .replace(',}', '}');
    expect(text).not.toContain('"root"');
    expect(() => parseManifest(text)).toThrow(ManifestError);
  });

  it('round-trips a valid manifest', () => {
    const m = manifest([install('a', 'github', 'h1')]);
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
  });

  it('rejects invalid JSON and wrong shapes with ManifestError', () => {
    expect(() => parseManifest('{ nope')).toThrow(ManifestError);
    expect(() => parseManifest('{"version":2,"installs":[]}')).toThrow(ManifestError);
  });
});
