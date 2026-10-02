import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_SKILL_BYTES, MAX_SKILL_FILES } from '@/domain/catalog/limits.js';
import { parseSkill, type SkillFile, type SkillParseResult } from '@/domain/catalog/skill.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const skillMd = (body: string): SkillFile => ({ path: 'SKILL.md', bytes: enc(body) });
const issueOf = (r: SkillParseResult): string => ('issue' in r ? r.issue : '');
const valid = '---\nname: demo\ndescription: Does a thing\n---\n\n# Demo\n';

describe('limits', () => {
  it('exposes the documented bounds', () => {
    expect(MAX_FILE_BYTES).toBe(1024 * 1024);
    expect(MAX_SKILL_FILES).toBe(100);
    expect(MAX_SKILL_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_DEPTH).toBe(8);
  });
});

describe('parseSkill', () => {
  it('parses a valid skill and keeps every file', () => {
    const extra: SkillFile = { path: 'assets/logo.bin', bytes: new Uint8Array([0, 255, 1]) };
    const result = parseSkill('demo', [skillMd(valid), extra]);
    expect(result).toEqual({
      skill: { name: 'demo', description: 'Does a thing', files: [skillMd(valid), extra] },
    });
  });

  it('accepts quoted values and CRLF line endings', () => {
    const text = '---\r\nname: "demo"\r\ndescription: \'Quoted: value\'\r\n---\r\nbody';
    const result = parseSkill('demo', [skillMd(text)]);
    expect(result).toMatchObject({ skill: { name: 'demo', description: 'Quoted: value' } });
  });

  it('reports a missing description', () => {
    const result = parseSkill('demo', [skillMd('---\nname: demo\n---\nbody')]);
    expect(issueOf(result)).toContain('description');
  });

  it('reports a multi-line value', () => {
    const folded = parseSkill('demo', [skillMd('---\nname: demo\ndescription: >\n  long text\n---\nbody')]);
    const continued = parseSkill('demo', [skillMd('---\nname: demo\ndescription: one\n  two\n---\nbody')]);
    expect(issueOf(folded)).toContain('multi-line');
    expect(issueOf(continued)).toContain('multi-line');
  });

  it('reports a name that does not match the directory', () => {
    const result = parseSkill('other', [skillMd(valid)]);
    expect(issueOf(result)).toContain("'demo'");
    expect(issueOf(result)).toContain("'other'");
  });

  it('reports a missing or unterminated frontmatter block', () => {
    expect(issueOf(parseSkill('demo', [skillMd('# no frontmatter')]))).toContain('frontmatter');
    expect(issueOf(parseSkill('demo', [skillMd('---\nname: demo\n')]))).toContain('frontmatter');
  });

  it('reports a missing SKILL.md', () => {
    const result = parseSkill('demo', [{ path: 'README.md', bytes: enc('x') }]);
    expect(issueOf(result)).toContain('SKILL.md');
  });

  it('rejects an invalid directory name', () => {
    expect(issueOf(parseSkill('../evil', [skillMd(valid)]))).toContain('../evil');
  });
});
