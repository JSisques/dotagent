import { describe, expect, it } from 'vitest';
import { sha256 } from '@/domain/hash.js';
import { ConfigError, detectIndent, mergeAtPath, readAtPath, removeAtPath } from '@/domain/json-merge.js';
import { parseDoc } from '@test/helpers/parse-doc.js';

const KEY = ['mcpServers'];

describe('json-merge', () => {
  it('creates the document when the file is missing', () => {
    const out = mergeAtPath(null, KEY, { github: { type: 'http' } });
    expect(JSON.parse(out)).toEqual({ mcpServers: { github: { type: 'http' } } });
    expect(out.endsWith('\n')).toBe(true);
  });

  it('keeps unknown keys and sibling servers at every depth, in order', () => {
    const before =
      JSON.stringify({ theme: 'dark', mcpServers: { other: { a: { b: 1 } } }, projects: { x: [1] } }, null, 2) + '\n';
    const out = mergeAtPath(before, KEY, { github: { type: 'http' } });
    const doc = parseDoc(out);
    expect(doc.theme).toBe('dark');
    expect(doc.projects).toEqual({ x: [1] });
    expect(Object.keys(doc)).toEqual(['theme', 'mcpServers', 'projects']);
    expect(Object.keys(doc.mcpServers)).toEqual(['other', 'github']);
    expect(doc.mcpServers.other).toEqual({ a: { b: 1 } });
  });

  it('aborts on corrupt JSON or wrong shapes without producing output', () => {
    expect(() => mergeAtPath('{ nope', KEY, {})).toThrow(ConfigError);
    expect(() => mergeAtPath('[]', KEY, {})).toThrow(ConfigError);
    expect(() => mergeAtPath('{"mcpServers": []}', KEY, {})).toThrow(ConfigError);
    expect(() => readAtPath('{ nope', KEY)).toThrow(ConfigError);
  });

  it('preserves detected indentation and a missing trailing newline', () => {
    expect(detectIndent('{\n    "a": 1\n}')).toBe(4);
    expect(detectIndent('{\n\t"a": 1\n}')).toBe('\t');
    expect(detectIndent('{"a":1}')).toBe(2);
    const out = mergeAtPath('{\n    "a": 1\n}', KEY, { s: { type: 'stdio' } });
    expect(out).toContain('\n    "a": 1');
    expect(out.endsWith('}')).toBe(true);
  });

  it('reads the servers map, empty when absent', () => {
    expect(readAtPath(null, KEY)).toEqual({});
    expect(readAtPath('{"mcpServers":{"a":{"x":1}}}', KEY)).toEqual({ a: { x: 1 } });
  });
});

describe('removeAtPath', () => {
  it('removes only the named entries and keeps siblings, key order, indent and trailing newline', () => {
    const doc = { theme: 'dark', mcpServers: { a: { x: 1 }, github: { y: 2 }, b: { z: 3 } }, last: [1] };
    const out = removeAtPath(JSON.stringify(doc, null, 4) + '\n', KEY, ['github']);
    const parsed = parseDoc(out);
    expect(Object.keys(parsed)).toEqual(['theme', 'mcpServers', 'last']);
    expect(Object.keys(parsed.mcpServers)).toEqual(['a', 'b']);
    expect(out).toContain('\n    "theme"');
    expect(out.endsWith('}\n')).toBe(true);
  });

  it('keeps a missing trailing newline and tab indentation, and leaves an emptied object as {}', () => {
    const out = removeAtPath('{\n\t"mcpServers": {\n\t\t"github": {}\n\t}\n}', KEY, ['github']);
    expect(JSON.parse(out)).toEqual({ mcpServers: {} });
    expect(out).toContain('\n\t"mcpServers"');
    expect(out.endsWith('}')).toBe(true);
  });

  it('ignores names and key paths that are absent', () => {
    const before = '{\n  "mcpServers": { "a": {} }\n}\n';
    expect(JSON.parse(removeAtPath(before, KEY, ['nope']))).toEqual({ mcpServers: { a: {} } });
    expect(JSON.parse(removeAtPath('{"x":1}', KEY, ['a']))).toEqual({ x: 1 });
  });

  it('aborts on corrupt JSON or a non-object at the key path', () => {
    expect(() => removeAtPath('{ nope', KEY, ['a'])).toThrow(ConfigError);
    expect(() => removeAtPath('[]', KEY, ['a'])).toThrow(ConfigError);
    expect(() => removeAtPath('{"mcpServers": []}', KEY, ['a'])).toThrow(ConfigError);
    expect(() => removeAtPath('{"mcpServers": 3}', KEY, ['a'])).toThrow(ConfigError);
  });
});

describe('hash', () => {
  it('hashes bytes with sha256 hex', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
