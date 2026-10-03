# Exploration: update-notifier

Source: GitHub issue #49 "feat: notify when a new CLI version is available".

## Current State

- `src/main.ts` is the composition root. It builds `CliDeps` and awaits `runCli(process.argv, deps)` from `src/adapters/cli/program.ts`.
- `CliDeps` holds `makeSource, fs, target, paths, env, prompter, out, err, now?`. `env` is already injected, so `SHITAKU_NO_UPDATE_CHECK` and `CI` can be read without touching `process` in `src/`.
- Commands: `init`, `undo`, `status` (commander). `status --json` prints one JSON document to stdout, so a notice must go to stderr.
- The current version is not read anywhere in `src/`; there is no `--version` flag. `package.json` is at `../package.json` from both `src/main.ts` and `dist/main.js`. `tsconfig.build.json` has `rootDir: src`, so a JSON import would break the build; read the version at runtime in `main.ts`.
- State-dir precedent: `stateDir(homeDir) = ${homeDir}/.claude/.shitaku` in `src/application/journal.ts`. Writes use `FileSystem.writeAtomic`; `readText` returns null when missing.
- No network port and no TTY/interactivity information exist yet.
- Tests: `test/setup.ts` makes `os.homedir()` throw and sandboxes `HOME`; tests inject paths with `makeTmpPaths()`. `test/architecture.test.ts` keeps the domain pure.
- Dependencies: `commander`, `@clack/prompts`, `zod`. Node >= 22.13 provides global `fetch` and `AbortSignal.timeout`.

## Affected Areas

- `src/domain/update.ts` (new): pure `isNewer`, zod cache schema `{checkedAt, latest}`, `isStale`, notice builder.
- `src/ports/version-source.ts` (new): `LatestVersionSource { latest(signal?): Promise<string | null> }`.
- `src/application/check-update.ts` (new): applies skip rules, reads/writes cache via `FileSystem`, calls the port when stale, returns `{ notice }`; never throws.
- `src/adapters/npm/registry-version-source.ts` (new): `fetch` on `https://registry.npmjs.org/@jsisques%2Fshitaku/latest` with timeout, zod-parsed `version`, null on failure.
- `src/adapters/cli/program.ts`: optional `updates?` in `CliDeps`; start check before dispatch, print notice via `deps.err` after the command.
- `src/main.ts`: read package version, compute `interactive`, wire adapter.
- `src/application/journal.ts`: reuse `stateDir` for `update-check.json`.
- Tests: domain, application, adapter, plus new cases in `test/adapters/cli/program.test.ts`.
- `README.md`: "Update notifications" subsection.

## Approaches

1. **Cache-first notice + bounded concurrent refresh** (global `fetch`, ~1.5s timeout, at most once per 24h). No new dependency, instant notice from cache, fully hexagonal and testable. Con: up to the timeout on a slow network once a day; notice may appear one run late after a release. Effort: Low-Medium.
2. **Detached background refresher** (child process writes the cache). Zero added latency, but needs `child_process`, a hidden entry in `dist`, Windows detach differences, cache-write races. Effort: High.
3. **Third-party `update-notifier`**. Mature, but adds a dependency tree, bypasses injected `Paths` and the no-real-home test rule, not hexagonal. Effort: Low, poor fit.

## Recommendation

Approach 1. Order of checks: gate on opt-out, `CI`, interactive TTY; read cache; refresh only if older than 24h; print one stderr line (new version + upgrade hint).

- Version comparison: pure `isNewer` for `x.y.z`; prerelease is never newer than same stable; invalid input is "not newer". No `semver` dependency.
- Offline: any fetch failure returns null; still write `checkedAt` so offline users are not retried on every command.
- Cache: JSON at `stateDir(homeDir)/update-check.json`, atomic write; corrupt cache treated as absent.
- Skip rules decided in the use case from injected `env` plus an `interactive` boolean.
- Errors are swallowed; exit code and command output never change.
- Test matrix: newer, same, older, offline, opt-out, CI, non-TTY, fresh cache (no fetch), stale cache (fetch), corrupt cache, `status --json` stdout untouched.

## Risks

- Latency up to the timeout once a day on a slow network.
- Cache path couples to `~/.claude/.shitaku`.
- Registry endpoint shape for scoped names: verify manually once during apply.
- Notice must never corrupt machine output (stderr-only, TTY-gated, guarded by test).
- Opt-out truthiness (`=1` only vs any truthy) must be pinned in the spec.
- New `CliDeps` fields must stay optional so existing tests stay offline.
- Review budget is tight (~250-350 lines incl. tests/README); split tasks by domain, use case, adapter, wiring.
- Rollback: remove optional `updates` wiring; new files are additive, leftover cache is harmless.

## Open decisions for the proposal

Opt-out truthiness rule, notice wording and upgrade hint, timeout (suggested 1.5s), cache path.

## Ready for Proposal

Yes.
