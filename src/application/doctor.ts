import { deriveOwnedItems } from '@/domain/manifest.js';
import { diagnose, type Finding, type ItemObservation } from '@/domain/plan/doctor-plan.js';
import { classifyStatus } from '@/domain/plan/status-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { desiredFor, observeInstalled } from './installed-state.js';
import { loadManifest } from './journal.js';

export interface DoctorDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Process environment, injected. Only used to check whether required variables are set; values are never reported. */
  env: Record<string, string | undefined>;
}

export interface DoctorReport {
  target: AgentTarget['id'];
  catalog: 'available' | 'unavailable';
  issues: CatalogIssue[];
  findings: Finding[];
}

/** Checks everything shitaku owns for problems and drift. Problems never depend on the catalog. Never writes. */
export async function getDiagnosis(deps: DoctorDeps, req: { scope?: Scope }): Promise<DoctorReport> {
  const manifest = await loadManifest(deps.fs, deps.paths.homeDir);
  const owned = deriveOwnedItems(manifest);

  let catalog: LoadedCatalog | null = null;
  try {
    catalog = await deps.source.load();
  } catch {
    // Without the catalog only the informational `out-of-date` finding is lost.
  }

  const observe = observeInstalled(deps);
  const observations: ItemObservation[] = [];
  for (const item of owned) {
    const { config, current, entry } = await observe(item);
    observations.push({
      item,
      config,
      current,
      ...(entry === undefined ? {} : { entry }),
      state: classifyStatus(item.hash, current, desiredFor(catalog, deps.target, item)),
    });
  }

  // Every scope is observed so a project entry can be compared with user scope; the filter applies to the findings.
  const { findings } = diagnose({
    observations,
    env: deps.env,
    projectConfigPath: deps.target.configPath('project', deps.paths),
  });

  return {
    target: deps.target.id,
    catalog: catalog === null ? 'unavailable' : 'available',
    issues: catalog?.issues ?? [],
    findings: findings.filter((f) => req.scope === undefined || f.scope === req.scope),
  };
}
