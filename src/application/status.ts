import { deriveOwnedItems } from '@/domain/manifest.js';
import { classifyStatus, type StatusItem } from '@/domain/plan/status-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { desiredFor, observeInstalled } from './installed-state.js';
import { loadManifest } from './journal.js';

export interface StatusDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
}

export interface StatusReport {
  target: AgentTarget['id'];
  catalog: 'available' | 'unavailable';
  items: StatusItem[];
  issues: CatalogIssue[];
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Reports, for every item shitaku owns, whether it is intact, drifted, outdated, gone or no longer offered. Never writes. */
export async function getStatus(deps: StatusDeps, req: { scope?: Scope }): Promise<StatusReport> {
  const manifest = await loadManifest(deps.fs, deps.paths.homeDir);
  const owned = deriveOwnedItems(manifest).filter((item) => req.scope === undefined || item.scope === req.scope);

  let catalog: LoadedCatalog | null = null;
  try {
    catalog = await deps.source.load();
  } catch {
    // A failed catalog degrades the catalog-dependent states to `unknown`; local drift is still reported.
  }

  const observe = observeInstalled(deps);

  const items: StatusItem[] = [];
  for (const item of owned) {
    const { current } = await observe(item);
    items.push({
      scope: item.scope,
      kind: item.kind,
      name: item.name,
      state: classifyStatus(item.hash, current, desiredFor(catalog, deps.target, item)),
      path: item.path,
      installId: item.installId,
    });
  }
  items.sort(
    (a, b) =>
      compare(a.scope, b.scope) || compare(a.kind, b.kind) || compare(a.name, b.name) || compare(a.path, b.path),
  );

  return {
    target: deps.target.id,
    catalog: catalog === null ? 'unavailable' : 'available',
    items,
    issues: catalog?.issues ?? [],
  };
}
