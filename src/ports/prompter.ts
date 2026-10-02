import type { McpItem } from '@/domain/catalog/schema.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import type { Scope } from './agent-target.js';

/** The user dismissed a prompt (Ctrl+C or escape); the command stops without writing. */
export class PromptCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/** A planned item that cannot be installed without replacing something the user has. */
export interface ConflictInfo {
  kind: 'mcp' | 'skill';
  name: string;
  reason: string;
}

export interface Prompter {
  /** May return an empty selection; the caller requires at least one item across both kinds. */
  selectMcps(options: McpItem[]): Promise<string[]>;
  /** Only asked when the catalog has skills. May return an empty selection. */
  selectSkills(options: SkillItem[]): Promise<string[]>;
  selectScope(): Promise<Scope>;
  resolveConflict(conflict: ConflictInfo): Promise<'overwrite' | 'skip'>;
  confirm(plan: ChangePlan): Promise<boolean>;
  info(message: string): void;
}
