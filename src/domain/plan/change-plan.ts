import type { AgentTarget, McpServerEntry, Scope } from '../../ports/agent-target.js';
import type { Paths } from '../../ports/paths.js';
import type { McpItem } from '../catalog/schema.js';
import { hashEntry, sha256 } from '../hash.js';
import { mergeAtPath, readAtPath } from '../json-merge.js';

export type Action = 'create' | 'update' | 'skip' | 'conflict';

export interface PlannedItem {
  name: string;
  action: Action;
  entry: McpServerEntry;
  reason?: string;
}

export interface FileChange {
  path: string;
  scope: Scope;
  beforeHash: string | null;
  before: string | null;
  after: string;
  items: PlannedItem[];
}

/** Whether a required variable is set; the value itself never enters the plan. */
export interface EnvStatus {
  name: string;
  set: boolean;
}

export interface ChangePlan {
  files: FileChange[];
  requiredEnv: EnvStatus[];
}

export interface BuildPlanInput {
  items: McpItem[];
  target: AgentTarget;
  scope: Scope;
  paths: Paths;
  /** Current content of the target file, null when it does not exist. */
  existing: string | null;
  env: Record<string, string | undefined>;
  /** Replace same-name entries whose content differs. */
  force?: boolean;
}

export const writesFile = (file: FileChange): boolean => file.items.some((i) => i.action === 'create' || i.action === 'update');

export function buildPlan(input: BuildPlanInput): ChangePlan {
  const { items, target, scope, paths, existing, env, force = false } = input;
  const keyPath = target.serversKeyPath(scope);
  const current = readAtPath(existing, keyPath);

  const planned: PlannedItem[] = items.map((item) => {
    const entry = target.toEntry(item);
    if (!target.supports(item)) return { name: item.name, action: 'skip', entry, reason: `not available for ${target.id}` };
    const present = current[item.name];
    if (present === undefined) return { name: item.name, action: 'create', entry };
    if (hashEntry(present) === hashEntry(entry)) return { name: item.name, action: 'skip', entry, reason: 'already installed' };
    if (force) return { name: item.name, action: 'update', entry, reason: 'overwritten by --force' };
    return { name: item.name, action: 'conflict', entry, reason: 'a different entry with this name exists' };
  });

  const writes = Object.fromEntries(planned.filter((p) => p.action === 'create' || p.action === 'update').map((p) => [p.name, p.entry]));
  const after = Object.keys(writes).length > 0 ? mergeAtPath(existing, keyPath, writes) : (existing ?? '');

  const required = new Map<string, boolean>();
  for (const item of items.filter((i) => target.supports(i))) {
    for (const v of item.env.filter((e) => e.required)) required.set(v.name, env[v.name] !== undefined && env[v.name] !== '');
  }

  const file: FileChange = {
    path: target.configPath(scope, paths),
    scope,
    beforeHash: existing === null ? null : sha256(existing),
    before: existing,
    after,
    items: planned,
  };
  return { files: [file], requiredEnv: [...required].map(([name, set]) => ({ name, set })) };
}
