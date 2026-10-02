# Design: Add a `status` command listing installed items (issue #45)

## Technical Approach

`status` is a read-only query over three inputs: the manifest (what shitaku owns), the disk (what is there now), and the catalog (what shitaku would install). A pure domain function classifies one item from three hash observations. The application use case gathers the observations through the existing ports (`FileSystem`, `AgentTarget`, `CatalogSource`) and returns a report model. The CLI renders that model as text or as versioned JSON. No new port, no manifest schema change, no write.

## Architecture Decisions

| Topic                      | Options                                 | Decision and rationale                                                                                                                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership with `installId` | extend `deriveOwnership` / new function | **New `deriveOwnedItems`** in `manifest.ts`. It replays active installs and keys items by `scope + path + name` (path = config path for MCPs, skill root for skills), so the newest install wins and keeps its `installId`. `deriveOwnership`/`deriveSkillOwnership` stay untouched, so `init`/`undo` behavior cannot change. |
| Classifier inputs          | raw `string \| null` / tagged unions    | **Tagged unions** for `current` (`absent`, `unreadable`, `hash`) and `desired` (`unavailable`, `absent`, `hash`). Avoids overloading `null`/`undefined` for three different meanings.                                                                                                                                         |
| Unreadable disk state      | abort / per item                        | **Per item → `modified`** (spec). `UnsafeTreeError`, `EACCES`/`EPERM` from a skill tree, and `ConfigError` from a config file map to `unreadable`; any other error propagates.                                                                                                                                                |
| Catalog failure            | abort / degrade                         | **Degrade**: any rejection of `source.load()` sets `catalog: 'unavailable'`; catalog-dependent states become `unknown`.                                                                                                                                                                                                       |
| Corrupt manifest           | catch in status / `guarded()`           | **Add `ManifestError` to `guarded()`'s known list.** Verified: today it is missing, so `init`/`undo` crash with a stack trace. The fix gives every command a clean `error: …` and exit 1.                                                                                                                                     |
| `readPresent` location     | duplicate / shared helper               | **Move to `src/application/skill-tree.ts`** (exported, unchanged body). It needs the `FileSystem` port, so it is not domain code.                                                                                                                                                                                             |
| Scope filter               | filter in CLI / in use case             | **In the use case**, so the other scope's files are never read.                                                                                                                                                                                                                                                               |
| JSON `version`             | in application / in renderer            | **Renderer** (`STATUS_JSON_VERSION = 1` in `program.ts`). The version belongs to the public contract, not to the model.                                                                                                                                                                                                       |

## Data Flow

    loadManifest ──ManifestError──> guarded() → exit 1
         │
    deriveOwnedItems ──filter(scope)──> OwnedItem[]
         │                      source.load() ──fail──> desired = unavailable
         ▼                             │
    per item: current = mcp: readText(path) → readAtPath → hashEntry(entry[name])
                        skill: readPresent(root) → treeHash
              desired = mcp: hashEntry(target.toEntry(item)); skill: treeHash(files)
         ▼
    classifyStatus(owned, current, desired) → StatusItem → sort(scope, kind, name, path)
         ▼
    CLI: text renderer | JSON renderer (version 1)

Config text is read once per path. A missing config file or entry gives `absent`. A catalog MCP that the target does not support counts as `absent` from the catalog.

**classifyStatus** (spec order): `current absent` → `missing`; `unreadable` or `current ≠ owned` → `modified`; `desired unavailable` → `unknown`; `desired absent` → `missing-from-catalog`; `desired ≠ owned` → `out-of-date`; else `installed`.

## Interfaces / Contracts

```ts
// domain/manifest.ts
export interface OwnedItem {
  kind: 'mcp' | 'skill';
  scope: Scope;
  path: string;
  name: string;
  hash: string;
  installId: string;
}
export function deriveOwnedItems(m: Manifest): OwnedItem[];
// domain/plan/status-plan.ts
export type ItemKind = OwnedItem['kind']; // widens when a new kind lands
export type StatusState = 'installed' | 'modified' | 'out-of-date' | 'missing' | 'missing-from-catalog' | 'unknown';
export type Observed = { kind: 'absent' } | { kind: 'unreadable' } | { kind: 'hash'; hash: string };
export type Desired = { kind: 'unavailable' } | { kind: 'absent' } | { kind: 'hash'; hash: string };
export function classifyStatus(owned: string, current: Observed, desired: Desired): StatusState;
export interface StatusItem {
  scope: Scope;
  kind: ItemKind;
  name: string;
  state: StatusState;
  path: string;
  installId: string;
}
// application/status.ts
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
export function getStatus(deps: StatusDeps, req: { scope?: Scope }): Promise<StatusReport>;
```

JSON (stdout only): `{ "version": 1, "target", "catalog", "items": [{ scope, kind, name, state, path, installId }] }`. Catalog issues and load errors go to stderr in both modes. Text: `target: claude-code`, `catalog unavailable` when degraded, then per scope `<scope> scope:`, a kind sub-header `  mcps:` / `  skills:` (omitted for kinds with no items), and rows `    <name>: <state>  <path>`; `no managed items` when empty. CLI: `status [--scope project|user] [--source <folder>] [--json]`, wrapped in `guarded()`, exit 0.

## File Changes

| File                                            | Action                                                            | Slice |
| ----------------------------------------------- | ----------------------------------------------------------------- | ----- |
| `src/domain/manifest.ts`                        | Modify: `OwnedItem`, `deriveOwnedItems`                           | 1     |
| `src/domain/plan/status-plan.ts`                | Create: types, `classifyStatus`                                   | 1     |
| `src/application/skill-tree.ts`, `init-mcps.ts` | Create/Modify: move `readPresent`                                 | 1     |
| `src/application/status.ts`                     | Create: `getStatus`                                               | 2     |
| `src/adapters/cli/program.ts`, `README.md`      | `status` command, renderers, `ManifestError` in `guarded()`, docs | 3     |

## Testing Strategy (strict TDD, RED first)

| Slice | Test file                              | Cases                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `test/domain/plan/status-plan.test.ts` | every state, precedence (`modified` over `out-of-date`, `missing` over all), degraded `unknown`                                                                                                                                                                             |
| 1     | `test/domain/manifest.test.ts`         | `deriveOwnedItems`: undone excluded, newest wins with its `installId`, same name in two scopes kept apart                                                                                                                                                                   |
| 2     | `test/application/status.test.ts`      | tmp fs + folder catalog: all states, scope filter, foreign config entries ignored, symlinked skill → `modified`, corrupt config → `modified`, catalog failure → `unknown`/`missing`, `ManifestError` rejects, empty manifest, no writes (fs spy rejects every write method) |
| 3     | `test/adapters/cli/program.test.ts`    | text output, JSON shape and `version: 1`, `--scope`, degraded header, corrupt manifest → stderr + exit 1, drift → exit 0                                                                                                                                                    |

Existing `init-mcps` tests cover the `readPresent` move. `test/architecture.test.ts` must pass unchanged.

## Slicing (400-line budget, chained PRs)

| PR  | Boundary                                                                 | Estimate |
| --- | ------------------------------------------------------------------------ | -------- |
| 1   | Domain classifier, `deriveOwnedItems`, `readPresent` move; no caller yet | ~220     |
| 2   | `getStatus` use case; not wired to the CLI                               | ~320     |
| 3   | CLI command, renderers, `guarded()` fix, README                          | ~240     |

Each slice builds and passes tests alone. PR 2 targets PR 1's branch, PR 3 targets PR 2's.

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process integration. Paths from a tampered manifest are only read, through `listFiles`/`readBytes`, which never follow symlinks and enforce the catalog limits.

## Migration / Rollout

No migration required. The command is read-only and the manifest schema is unchanged.

## Open Questions

- [ ] The spec covers unsafe skill trees only; this design also maps an unparseable config file to `modified` per item, so one broken `.mcp.json` does not hide the other scope. The spec should confirm this.
