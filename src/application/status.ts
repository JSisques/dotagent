import { hashEntry, treeHash } from '@/domain/hash.js';
import { ConfigError, readAtPath } from '@/domain/json-merge.js';
import { deriveOwnedItems, type OwnedItem } from '@/domain/manifest.js';
import { classifyStatus, type Desired, type Observed, type StatusItem } from '@/domain/plan/status-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { loadManifest } from './journal.js';
import { readPresent } from './skill-tree.js';

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

/** The servers object of a config file, or `unreadable` when the file cannot be parsed. */
type ConfigEntries = Record<string, unknown> | 'unreadable';

const UNREADABLE: Observed = { kind: 'unreadable' };
const ABSENT: Observed = { kind: 'absent' };

/** Filesystem errors that mean a path exists but cannot be read as expected. */
const UNREADABLE_CODES = new Set(['EACCES', 'EPERM', 'ENOTDIR', 'EISDIR', 'ELOOP']);

/** Failures that make one item unreadable. Anything else is a real fault and propagates. */
function isUnreadable(error: unknown): boolean {
  if (error instanceof UnsafeTreeError || error instanceof ConfigError) return true;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code !== undefined && UNREADABLE_CODES.has(code);
}

async function orUnreadable(read: () => Promise<Observed>): Promise<Observed> {
  try {
    return await read();
  } catch (error) {
    if (isUnreadable(error)) return UNREADABLE;
    throw error;
  }
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

  const configs = new Map<string, Promise<ConfigEntries>>();
  const readConfig = (item: OwnedItem): Promise<ConfigEntries> => {
    const configKey = JSON.stringify([item.scope, item.path]);
    let entries = configs.get(configKey);
    if (entries === undefined) {
      entries = deps.fs
        .readText(item.path)
        .then((text) => readAtPath(text, deps.target.serversKeyPath(item.scope)))
        .catch((error: unknown) => {
          if (isUnreadable(error)) return 'unreadable' as const;
          throw error;
        });
      configs.set(configKey, entries);
    }
    return entries;
  };

  const currentMcp = async (item: OwnedItem): Promise<Observed> => {
    const entries = await readConfig(item);
    if (entries === 'unreadable') return UNREADABLE;
    const entry = entries[item.name];
    return entry === undefined ? ABSENT : { kind: 'hash', hash: hashEntry(entry) };
  };

  const currentSkill = (item: OwnedItem): Promise<Observed> =>
    orUnreadable(async () => {
      const files = await readPresent(deps.fs, item.path);
      const hash = files === null ? null : treeHash(files);
      return hash === null ? ABSENT : { kind: 'hash', hash };
    });

  const desiredFor = (item: OwnedItem): Desired => {
    if (catalog === null) return { kind: 'unavailable' };
    if (item.kind === 'mcp') {
      const mcp = catalog.mcps.find((m) => m.name === item.name);
      return mcp !== undefined && deps.target.supports(mcp)
        ? { kind: 'hash', hash: hashEntry(deps.target.toEntry(mcp)) }
        : { kind: 'absent' };
    }
    const hash = treeHash(catalog.skills.find((s) => s.name === item.name)?.files ?? []);
    return hash === null ? { kind: 'absent' } : { kind: 'hash', hash };
  };

  const items: StatusItem[] = [];
  for (const item of owned) {
    const current = await (item.kind === 'mcp' ? currentMcp(item) : currentSkill(item));
    items.push({
      scope: item.scope,
      kind: item.kind,
      name: item.name,
      state: classifyStatus(item.hash, current, desiredFor(item)),
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
