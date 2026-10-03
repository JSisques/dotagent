# Design: Notify when a new CLI version is available (issue #49)

## Technical Approach

`runCli` starts one never-rejecting update check before commander dispatch and awaits it after the command returns. The check reads `stateDir(homeDir)/update-check.json`; only when the cache is absent, corrupt or older than 24h does it call a `LatestVersionSource` port with an abort signal that fires after 1.5s. The npm adapter uses global `fetch`. The result, or a stderr line, is the only output. With no `updates` in `CliDeps` (all existing tests), nothing runs.

## Architecture Decisions

| Topic              | Options                            | Decision and rationale                                                                                                                                                           |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CliDeps` shape    | notice thunk / settings plus port  | **`updates?: UpdateSettings`** (port plus version plus `interactive`). `program.ts` builds use-case deps from `fs`, `paths`, `env`, `now`, like `init`/`status`.                 |
| Timeout owner      | adapter / use case                 | **Use case** creates `AbortSignal.timeout(timeoutMs)` (default 1500) and passes it to the port. One owner; tests pass a small `timeoutMs`.                                       |
| Notice value       | cached only / fresh when fetched   | **Fresh if the fetch succeeded, else cached.** We await anyway, so the cache-only lag buys nothing.                                                                              |
| Failed refresh     | skip write / write                 | **Write `{checkedAt: now, latest: previous ?? null}`.** No retry storm offline; a known newer version keeps showing.                                                             |
| When to print      | `finally` / after normal return    | **After normal return**, including the `CommanderError` path. An unknown error propagating from a command prints nothing.                                                        |
| `interactive`      | stderr TTY / stdout and stderr TTY | **Both TTY**, computed in `main.ts`. `status --json \| jq` skips.                                                                                                                |
| Version comparison | `semver` dep / pure parser         | **Pure `isNewer`** for `x.y.z[-pre][+build]`; invalid input is never newer. Only regex-valid versions reach the notice, so a tampered payload cannot inject terminal escapes.    |
| Package version    | JSON import / runtime read         | **Runtime read** in `main.ts` via `readFileSync(new URL('../package.json', import.meta.url))`; a JSON import breaks `rootDir: src`. Unreadable or non-string: `updates` omitted. |
| Clock skew         | trust cache / bound it             | **Stale when `checkedAt` is in the future**, so a bad clock cannot suppress checks forever.                                                                                      |

## Data Flow

    runCli ── deps.updates? ──no──> dispatch only
       │ yes
       ├─ pending = checkForUpdate(...)      (started, not awaited)
       ├─ dispatch command (parseAsync)  ──> exitCode
       └─ notice = await pending  ──> notice ? deps.err(notice) ──> return exitCode

    checkForUpdate: skip(opt-out | CI | !interactive) → null
      readText(cache) → parseUpdateCache (corrupt → null)
      fresh? → latest = cache.latest
      stale? → source.latest(AbortSignal.timeout) → writeAtomic(cache) → latest = fetched ?? cache?.latest
      isNewer(current, latest) ? updateNotice(...) : null
      any throw → null

Worst-case added wall time is `timeoutMs`, once per 24h, and only when the command finished first.

## Interfaces / Contracts

```ts
// src/domain/update.ts (zod only, no fs/os/path/process)
export const UPDATE_TTL_MS = 86_400_000;
export interface UpdateCache {
  checkedAt: string;
  latest: string | null;
} // ISO timestamp
export function parseUpdateCache(text: string): UpdateCache | null;
export function isStale(cache: UpdateCache | null, now: Date, ttlMs?: number): boolean;
export function isNewer(current: string, candidate: string | null): boolean;
export function isTruthyFlag(value: string | undefined): boolean; // 1,true,yes,on; case-insensitive, trimmed
export function updateNotice(current: string, latest: string): string;
// "Update available: shitaku 0.2.0 -> 0.3.0. Run: npm install -g @jsisques/shitaku"

// src/ports/version-source.ts
export interface LatestVersionSource {
  /** Resolves to null on any failure; settles promptly once `signal` aborts. */
  latest(signal: AbortSignal): Promise<string | null>;
}

// src/application/check-update.ts
export const updateCachePath = (homeDir: string): string => `${stateDir(homeDir)}/update-check.json`;
export interface UpdateCheckDeps {
  fs: FileSystem;
  paths: Paths;
  env: Record<string, string | undefined>;
  source: LatestVersionSource;
  now?: () => Date;
}
export interface UpdateCheckRequest {
  currentVersion: string;
  interactive: boolean;
  timeoutMs?: number;
}
export function checkForUpdate(deps: UpdateCheckDeps, req: UpdateCheckRequest): Promise<string | null>; // never rejects

// src/adapters/cli/program.ts
export interface UpdateSettings {
  source: LatestVersionSource;
  currentVersion: string;
  interactive: boolean;
  timeoutMs?: number;
}
// CliDeps gains: updates?: UpdateSettings

// src/adapters/npm/registry-version-source.ts
export class NpmRegistryVersionSource implements LatestVersionSource {
  constructor(packageName: string, fetchFn?: typeof fetch, registry?: string); // GET {registry}/@jsisques%2Fshitaku/latest
}
```

Skip rules: `isTruthyFlag(env.SHITAKU_NO_UPDATE_CHECK)`, `CI` non-empty, or `!interactive`. A skipped check neither reads nor writes the cache.

## File Changes

| File                                                                                                                                                            | Action        | Description                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| `src/domain/update.ts`                                                                                                                                          | Create        | Pure rules above                                                |
| `src/ports/version-source.ts`                                                                                                                                   | Create        | Port                                                            |
| `src/application/check-update.ts`                                                                                                                               | Create        | Use case; reuses `stateDir` from `journal.ts`                   |
| `src/adapters/npm/registry-version-source.ts`                                                                                                                   | Create        | `fetch`, `res.ok`, zod `{ version: string }`, null on any error |
| `src/adapters/cli/program.ts`                                                                                                                                   | Modify        | `UpdateSettings`, start/await/print                             |
| `src/main.ts`                                                                                                                                                   | Modify        | Read version, compute TTY, wire adapter                         |
| `README.md`                                                                                                                                                     | Modify        | "Update notifications" section                                  |
| `test/domain/update.test.ts`, `test/application/check-update.test.ts`, `test/adapters/npm/registry-version-source.test.ts`, `test/adapters/cli/program.test.ts` | Create/Modify | See below                                                       |

## Testing Strategy (strict TDD, RED first)

| Layer       | Cases                                                                                                                                                                                                                | Approach                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Domain      | `isNewer` newer/same/older/prerelease/invalid/null; `isStale` fresh/24h/future/null; flag truthiness; cache parse corrupt/valid                                                                                      | `it.each` tables                                               |
| Application | opt-out, CI, non-TTY (source spy not called, no cache write); fresh (no fetch); stale/absent/corrupt (fetch + write); offline keeps old `latest`; source throws → null; fs throws → null; slow source honors timeout | `NodeFileSystem` on `makeTmpPaths()`, fake source, fixed `now` |
| Adapter     | URL encoding, ok payload, non-ok, bad JSON, schema miss, rejected fetch, abort                                                                                                                                       | injected fake `fetchFn`; no network                            |
| CLI         | notice on stderr after command; nothing when same version; `status --json` stdout parses unchanged; exit code unchanged; no `updates` → no check                                                                     | fake source in `CliDeps`                                       |

`test/architecture.test.ts` passes unchanged: domain imports only zod, `homedir` stays in `main.ts`, and `new URL('../package.json', …)` is not a module specifier. `test/naming.test.ts` passes partial deps without `updates`, which must keep working.

## Review Budget

Estimate ~380-430 lines with tests and README. Target one PR using table-driven tests. If tasks forecast over 400: PR 1 = domain + port + use case (~260, unwired); PR 2 = adapter + CLI + `main.ts` + README (~150).

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process integration. The single outbound request uses a constant URL with no user input. Registry and cache data are zod-parsed, and only versions matching the semver regex are printed.

## Migration / Rollout

No migration required. The cache file is new and harmless if left behind.

## Open Questions

- [ ] Spec should pin `CI` semantics (design: any non-empty value) and the exact notice wording.
