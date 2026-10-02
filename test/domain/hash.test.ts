import { describe, expect, it } from 'vitest';
import { sha256, treeHash } from '@/domain/hash.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const file = (path: string, text: string): { path: string; bytes: Uint8Array } => ({ path, bytes: enc(text) });

describe('sha256', () => {
  it('hashes text and its UTF-8 bytes identically', () => {
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(sha256(enc('hello'))).toBe(sha256('hello'));
  });

  it('hashes non-text bytes', () => {
    expect(sha256(new Uint8Array([0, 255])).length).toBe(64);
    expect(sha256(new Uint8Array([0, 255]))).not.toBe(sha256(new Uint8Array([255, 0])));
  });
});

describe('treeHash', () => {
  it('is independent of entry order', () => {
    const a = file('SKILL.md', 'one');
    const b = file('docs/x.md', 'two');
    expect(treeHash([a, b])).toBe(treeHash([b, a]));
  });

  it('returns null for an empty tree', () => {
    expect(treeHash([])).toBeNull();
  });

  it('changes when content or path changes', () => {
    const base = treeHash([file('a', 'x')]);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(treeHash([file('a', 'y')])).not.toBe(base);
    expect(treeHash([file('b', 'x')])).not.toBe(base);
  });

  it('follows the documented construction', () => {
    const expected = sha256(`a\0${sha256('1')}\nb\0${sha256('2')}\n`);
    expect(treeHash([file('b', '2'), file('a', '1')])).toBe(expected);
  });
});
