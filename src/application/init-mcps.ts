import { buildPlan, writesFile } from '../domain/plan/change-plan.js';
import type { ChangePlan } from '../domain/plan/change-plan.js';
import type { AgentTarget, Scope } from '../ports/agent-target.js';
import type { CatalogSource } from '../ports/catalog-source.js';
import type { FileSystem } from '../ports/file-system.js';
import type { Paths } from '../ports/paths.js';

export interface InitDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Process environment, injected. Only used to report whether required variables are set. */
  env: Record<string, string | undefined>;
}

export interface InitRequest {
  mcps: string[];
  scope: Scope;
  force?: boolean;
  dryRun?: boolean;
}

export class UnknownMcpError extends Error {}

export async function planInit(deps: InitDeps, req: InitRequest): Promise<ChangePlan> {
  const catalog = await deps.source.load();
  const unknown = req.mcps.filter((name) => !catalog.mcps.some((m) => m.name === name));
  if (unknown.length > 0) throw new UnknownMcpError(`unknown MCP: ${unknown.join(', ')}`);
  const items = req.mcps.map((name) => catalog.mcps.find((m) => m.name === name)!);
  const existing = await deps.fs.readText(deps.target.configPath(req.scope, deps.paths));
  return buildPlan({ items, target: deps.target, scope: req.scope, paths: deps.paths, existing, env: deps.env, force: req.force });
}

/** Writes every file the plan changes. Backup, re-read and manifest arrive with the safety slice. */
export async function applyPlan(deps: InitDeps, plan: ChangePlan): Promise<boolean> {
  const changed = plan.files.filter(writesFile);
  for (const file of changed) await deps.fs.writeAtomic(file.path, file.after);
  return changed.length > 0;
}

export async function initMcps(deps: InitDeps, req: InitRequest): Promise<{ plan: ChangePlan; applied: boolean }> {
  const plan = await planInit(deps, req);
  if (req.dryRun) return { plan, applied: false };
  return { plan, applied: await applyPlan(deps, plan) };
}
