import { z } from 'zod';

// The custom message names the offending value, which zod's default regex message omits.
export const SkillNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: (iss) => `invalid skill name '${String(iss.input)}'` });

/** One file of a skill. `path` is POSIX and relative to the skill root. */
export interface SkillFile {
  path: string;
  bytes: Uint8Array;
}

export interface SkillItem {
  name: string;
  description: string;
  files: SkillFile[];
}

/** An issue may carry `file`: the path, relative to the skill directory, of the file the problem lives in. */
export type SkillIssue = { issue: string; file?: string };
export type SkillParseResult = { skill: SkillItem } | SkillIssue;

const SKILL_FILE = 'SKILL.md';
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ScalarSchema = z.object({ name: SkillNameSchema, description: z.string().min(1) });

const unquote = (value: string): string => {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
};

/** Minimal frontmatter reader: single-line `key: value` scalars only. A multi-line value is an issue. */
function readFrontmatter(text: string): { data: Record<string, string> } | SkillIssue {
  const match = FRONTMATTER.exec(text);
  if (!match) return { issue: `${SKILL_FILE} has no frontmatter block`, file: SKILL_FILE };
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    if (line.trim() === '') continue;
    if (/^\s/.test(line))
      return { issue: 'frontmatter has a multi-line value, only single-line values are supported', file: SKILL_FILE };
    const colon = line.indexOf(':');
    if (colon < 1) return { issue: `frontmatter line is not 'key: value': ${line}`, file: SKILL_FILE };
    const value = line.slice(colon + 1).trim();
    if (value === '' || /^[|>][+-]?$/.test(value)) {
      return { issue: `frontmatter key '${line.slice(0, colon)}' has a multi-line or empty value`, file: SKILL_FILE };
    }
    data[line.slice(0, colon).trim()] = unquote(value);
  }
  return { data };
}

/** Validates a skill directory's files against its frontmatter and directory name. */
export function parseSkill(dirName: string, files: readonly SkillFile[]): SkillParseResult {
  if (!SkillNameSchema.safeParse(dirName).success) return { issue: `invalid skill directory name '${dirName}'` };
  const entry = files.find((f) => f.path === SKILL_FILE);
  if (!entry) return { issue: `missing ${SKILL_FILE}` };
  const front = readFrontmatter(new TextDecoder().decode(entry.bytes));
  if ('issue' in front) return front;
  const parsed = ScalarSchema.safeParse(front.data);
  if (!parsed.success) {
    return { issue: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), file: SKILL_FILE };
  }
  if (parsed.data.name !== dirName) {
    return { issue: `name '${parsed.data.name}' does not match directory '${dirName}'` };
  }
  return { skill: { name: parsed.data.name, description: parsed.data.description, files: [...files] } };
}
