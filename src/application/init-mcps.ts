import { randomBytes } from 'node:crypto';
import { basename } from 'node:path';
import { hashEntry, sha256 } from '@/domain/hash.js';
import type { Install } from '@/domain/manifest.js';
import { deriveOwnership } from '@/domain/manifest.js';
import { buildPlan, replanFile, writesFile } from '@/domain/plan/change-plan.js';
import type { ChangePlan, FileChange } from '@/domain/plan/change-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { appendInstall, loadManifest, stateDir } from './journal.js';

export interface InitDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Process environment, injected. Only used to report whether required variables are set. */
  env: Record<string, string | undefined>;
  /** Clock for install ids and timestamps; defaults to the system clock. */
  now?: () => Date;
}

export interface InitRequest {
  mcps: string[];
  scope: Scope;
  force?: boolean;
  dryRun?: boolean;
}

export class UnknownMcpError extends Error {}
/** The target changed between planning and applying in a way that alters the plan. */
export class StaleFileError extends Error {}
/** A resolved env value would be written to disk. */
export class LeakError extends Error {}

export async function planInit(deps: InitDeps, req: InitRequest): Promise<ChangePlan> {
  const catalog = await deps.source.load();
  const unknown = req.mcps.filter((name) => !catalog.mcps.some((m) => m.name === name));
  if (unknown.length > 0) throw new UnknownMcpError(`unknown MCP: ${unknown.join(', ')}`);
  const items = req.mcps.map((name) => catalog.mcps.find((m) => m.name === name)!);
  const path = deps.target.configPath(req.scope, deps.paths);
  const existing = await deps.fs.readText(path);
  const owned = deriveOwnership(await loadManifest(deps.fs, deps.paths.homeDir))[path] ?? {};
  return buildPlan({
    items,
    target: deps.target,
    scope: req.scope,
    paths: deps.paths,
    existing,
    env: deps.env,
    force: req.force,
    owned,
  });
}

const actions = (file: FileChange): string => file.items.map((i) => `${i.name}:${i.action}`).join(',');

/** Re-reads each file; re-plans once if it changed, aborting when the actions differ. */
async function refresh(
  deps: InitDeps,
  file: FileChange,
  owned: Record<string, string>,
  force: boolean,
): Promise<FileChange> {
  const fresh = await deps.fs.readText(file.path);
  if ((fresh === null ? null : sha256(fresh)) === file.beforeHash) return file;
  const replanned = replanFile(file, fresh, deps.target.serversKeyPath(file.scope), owned, force);
  if (actions(replanned) !== actions(file)) throw new StaleFileError(`${file.path} changed since planning, re-run`);
  return replanned;
}

function assertNoLeak(plan: ChangePlan, files: FileChange[], env: InitDeps['env']): void {
  for (const name of plan.declaredEnv) {
    const value = env[name];
    if (value && files.some((f) => f.after.includes(value)))
      throw new LeakError(`the value of ${name} would be written to disk; aborting`);
  }
}

/** Re-reads, scans for leaked values, backs up, writes atomically and journals every changed file. */
export async function applyPlan(deps: InitDeps, plan: ChangePlan, opts: { force?: boolean } = {}): Promise<boolean> {
  const { homeDir } = deps.paths;
  const ownership = deriveOwnership(await loadManifest(deps.fs, homeDir));
  const files: FileChange[] = [];
  for (const file of plan.files.filter(writesFile))
    files.push(await refresh(deps, file, ownership[file.path] ?? {}, opts.force ?? false));
  if (files.length === 0) return false;
  assertNoLeak(plan, files, deps.env);

  const now = (deps.now ?? (() => new Date()))();
  const id = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}-${randomBytes(2).toString('hex')}`;
  const installed: Install['files'] = [];
  for (const [n, file] of files.entries()) {
    const backup = file.before === null ? null : `backups/${id}/${n}-${basename(file.path)}`;
    if (backup !== null) await deps.fs.writeAtomic(`${stateDir(homeDir)}/${backup}`, file.before!);
    await deps.fs.writeAtomic(file.path, file.after);
    const written = file.items.filter((i) => i.action === 'create' || i.action === 'update');
    installed.push({
      path: file.path,
      scope: file.scope,
      backup,
      beforeHash: file.beforeHash,
      afterHash: sha256(file.after),
      items: written.map((i) => ({
        kind: 'mcp',
        name: i.name,
        action: i.action as 'create' | 'update',
        entryHash: hashEntry(i.entry),
      })),
    });
  }
  const source = deps.source.ref();
  await appendInstall(deps.fs, homeDir, {
    id,
    createdAt: now.toISOString(),
    undoneAt: null,
    source: { ...source, catalogVersion: 1 },
    files: installed,
  });
  return true;
}

export async function initMcps(deps: InitDeps, req: InitRequest): Promise<{ plan: ChangePlan; applied: boolean }> {
  const plan = await planInit(deps, req);
  if (req.dryRun) return { plan, applied: false };
  return { plan, applied: await applyPlan(deps, plan, { force: req.force }) };
}
