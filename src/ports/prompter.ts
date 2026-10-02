import type { McpItem } from '@/domain/catalog/schema.js';
import type { ChangePlan, PlannedItem } from '@/domain/plan/change-plan.js';
import type { Scope } from './agent-target.js';

/** The user dismissed a prompt (Ctrl+C or escape); the command stops without writing. */
export class PromptCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

export interface Prompter {
  selectMcps(options: McpItem[]): Promise<string[]>;
  selectScope(): Promise<Scope>;
  resolveConflict(item: PlannedItem): Promise<'overwrite' | 'skip'>;
  confirm(plan: ChangePlan): Promise<boolean>;
  info(message: string): void;
}
