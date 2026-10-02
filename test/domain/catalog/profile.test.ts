import { describe, expect, it } from 'vitest';
import { resolveProfile, validateProfiles } from '@/domain/catalog/profile.js';
import type { Profile } from '@/domain/catalog/schema.js';

const p = (name: string, mcps: string[] = [], ext: string[] = [], skills: string[] = []): Profile => ({
  name,
  mcps,
  extends: ext,
  skills,
});
const MCPS = ['github', 'context7'];
const SKILLS = ['review', 'plan'];

describe('resolveProfile', () => {
  it('merges parents first and de-duplicates', () => {
    const profiles = [p('base', ['context7']), p('web', ['github', 'context7'], ['base'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS)).toEqual({ mcps: ['context7', 'github'], skills: [] });
  });

  it('merges skills through extends and de-duplicates', () => {
    const profiles = [p('base', [], [], ['review']), p('web', [], ['base'], ['plan', 'review'])];
    expect(resolveProfile('web', profiles, MCPS, SKILLS)).toEqual({ mcps: [], skills: ['review', 'plan'] });
  });

  it('fails on a cycle naming the path', () => {
    const profiles = [p('a', [], ['b']), p('b', [], ['a'])];
    expect(() => resolveProfile('a', profiles, MCPS, SKILLS)).toThrow('a -> b -> a');
  });

  it('fails on an unknown mcp', () => {
    expect(() => resolveProfile('a', [p('a', ['ghost'])], MCPS, SKILLS)).toThrow('ghost');
  });

  it('fails on an unknown skill', () => {
    expect(() => resolveProfile('a', [p('a', [], [], ['ghost'])], MCPS, SKILLS)).toThrow("unknown skill 'ghost'");
  });

  it('fails on an unknown profile', () => {
    expect(() => resolveProfile('a', [p('a', [], ['nope'])], MCPS, SKILLS)).toThrow('nope');
    expect(() => resolveProfile('missing', [], MCPS, SKILLS)).toThrow('missing');
  });
});

describe('validateProfiles', () => {
  it('returns no errors for a valid set', () => {
    expect(validateProfiles([p('base', ['context7'], [], ['review'])], MCPS, SKILLS)).toEqual([]);
  });

  it('collects one error per invalid profile', () => {
    const errors = validateProfiles(
      [p('a', [], ['b']), p('b', [], ['a']), p('c', ['ghost']), p('d', [], [], ['ghost'])],
      MCPS,
      SKILLS,
    );
    expect(errors).toHaveLength(4);
  });
});
