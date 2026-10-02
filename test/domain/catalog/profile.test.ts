import { describe, expect, it } from 'vitest';
import { resolveProfile, validateProfiles } from '@/domain/catalog/profile.js';
import type { Profile } from '@/domain/catalog/schema.js';

const p = (name: string, mcps: string[] = [], ext: string[] = []): Profile => ({ name, mcps, extends: ext });
const MCPS = ['github', 'context7'];

describe('resolveProfile', () => {
  it('merges parents first and de-duplicates', () => {
    const profiles = [p('base', ['context7']), p('web', ['github', 'context7'], ['base'])];
    expect(resolveProfile('web', profiles, MCPS)).toEqual(['context7', 'github']);
  });

  it('fails on a cycle naming the path', () => {
    const profiles = [p('a', [], ['b']), p('b', [], ['a'])];
    expect(() => resolveProfile('a', profiles, MCPS)).toThrow('a -> b -> a');
  });

  it('fails on an unknown mcp', () => {
    expect(() => resolveProfile('a', [p('a', ['ghost'])], MCPS)).toThrow('ghost');
  });

  it('fails on an unknown profile', () => {
    expect(() => resolveProfile('a', [p('a', [], ['nope'])], MCPS)).toThrow('nope');
    expect(() => resolveProfile('missing', [], MCPS)).toThrow('missing');
  });
});

describe('validateProfiles', () => {
  it('returns no errors for a valid set', () => {
    expect(validateProfiles([p('base', ['context7'])], MCPS)).toEqual([]);
  });

  it('collects one error per invalid profile', () => {
    const errors = validateProfiles([p('a', [], ['b']), p('b', [], ['a']), p('c', ['ghost'])], MCPS);
    expect(errors).toHaveLength(3);
  });
});
