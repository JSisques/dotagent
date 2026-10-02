import type { SkillFile, SkillItem } from '@/domain/catalog/skill.js';
import { treeHash } from '@/domain/hash.js';
import type { Action } from '@/domain/plan/change-plan.js';

export interface SkillChange {
  name: string;
  /** Absolute path of the skill directory. */
  root: string;
  action: Action;
  reason?: string;
  /** The files of the catalog version, the ones an install writes. */
  files: SkillFile[];
  /** What the directory holds now; empty when it is absent. Kept so an apply can back the bytes up. */
  present: SkillFile[];
  /** Present files the catalog version does not have. An update deletes them; other actions list none. */
  removed: string[];
  desiredHash: string;
  /** Tree hash of `present`; null when the directory is absent or empty. */
  presentHash: string | null;
}

export interface SkillPlanEntry {
  skill: SkillItem;
  root: string;
  /** Files found at `root`, null when it does not exist. */
  present: SkillFile[] | null;
}

export interface BuildSkillPlanInput {
  skills: SkillPlanEntry[];
  /** skill root -> tree hash of the version shitaku last installed there (derived from the manifest). */
  owned: Record<string, string>;
  /** Replace a differing tree even when shitaku does not own it. */
  force?: boolean;
}

/** Decides what to do with one skill directory given its present tree hash (null when absent). */
export function classifySkill(
  present: string | null,
  desired: string,
  owned: string | undefined,
  force: boolean,
): { action: Action; reason?: string } {
  if (present === null) return { action: 'create' };
  if (present === desired) return { action: 'skip', reason: 'already installed' };
  if (force) return { action: 'update', reason: 'replaced by --force' };
  if (owned === present) return { action: 'update', reason: 'installed by shitaku' };
  return {
    action: 'conflict',
    reason: owned === undefined ? 'a different skill with this name exists' : 'modified since shitaku installed it',
  };
}

export function buildSkillPlan({ skills, owned, force = false }: BuildSkillPlanInput): SkillChange[] {
  return skills.map(({ skill, root, present }): SkillChange => {
    const presentFiles = present ?? [];
    const desiredHash = treeHash(skill.files) ?? '';
    const presentHash = treeHash(presentFiles);
    const decision = classifySkill(presentHash, desiredHash, owned[root], force);
    const kept = new Set(skill.files.map((f) => f.path));
    return {
      name: skill.name,
      root,
      ...decision,
      files: skill.files,
      present: presentFiles,
      removed: decision.action === 'update' ? presentFiles.map((f) => f.path).filter((p) => !kept.has(p)) : [],
      desiredHash,
      presentHash,
    };
  });
}
