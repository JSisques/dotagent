# Proposal: Notify when a new CLI version is available (issue #49)

## Intent

Users running an old shitaku (often a global install) do not learn about new releases. Show a single, non-intrusive stderr notice when a newer version exists, without slowing commands or breaking machine output.

## Scope

### In Scope

- Cache-first check: notice from `stateDir(homeDir)/update-check.json` (`{checkedAt, latest}`); refresh from the npm registry only when older than 24h.
- Refresh via global `fetch` with ~1.5s timeout, concurrent with the command. No new dependencies.
- Failures (offline, timeout, bad payload) still write `checkedAt`: no retry on every command. Corrupt cache is treated as absent.
- Skip when `SHITAKU_NO_UPDATE_CHECK` is truthy (e.g. `1`, `true`, `yes`; case-insensitive; empty, `0`, `false`, `no` are not truthy), when `CI` is set, or when output is non-interactive (non-TTY).
- One stderr line: new version plus `npm install -g @jsisques/shitaku`. Never touches stdout, `status --json`, or exit code; errors are swallowed.
- README "Update notifications" section (behavior, opt-out).

### Out of Scope

- An `upgrade`/self-update command (separate issue).
- A `--version` flag, background child-process refresher, `semver`/`update-notifier` dependencies.

## Capabilities

### New Capabilities

- `update-notifier`: version comparison, cache TTL, skip rules, offline behavior, notice format and stream.

### Modified Capabilities

- None.

## Approach

Approach 1 from exploration. Hexagonal layers:

| Layer       | Path                                          | Impact                                                            |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------- |
| domain      | `src/domain/update.ts`                        | New: `isNewer`, cache schema, `isStale`, notice text              |
| ports       | `src/ports/version-source.ts`                 | New: `LatestVersionSource.latest(signal?)`                        |
| application | `src/application/check-update.ts`             | New: skip rules, cache read/write via `FileSystem`, never throws  |
| adapters    | `src/adapters/npm/registry-version-source.ts` | New: registry `fetch`, zod-parsed `version`, null on failure      |
| adapters    | `src/adapters/cli/program.ts`                 | Modified: optional `updates?` in `CliDeps`, notice via `deps.err` |
| root        | `src/main.ts`                                 | Modified: read package version, TTY flag, wiring                  |
| docs/tests  | `README.md`, `test/**`                        | New/Modified                                                      |

## Risks

| Risk                                           | Likelihood | Mitigation                                        |
| ---------------------------------------------- | ---------- | ------------------------------------------------- |
| Up to 1.5s added once per day on slow networks | Med        | Hard timeout; cache-first notice                  |
| Notice corrupts machine output                 | Low        | stderr + TTY gate; `status --json` test           |
| Scoped registry URL shape                      | Low        | zod-validated; manual check during apply          |
| Existing tests hit the network                 | Low        | `updates?` optional; absent means no check        |
| Budget overrun                                 | Med        | Est. 300-380 lines; split if forecast exceeds 400 |

## Rollback Plan

Revert the PR. All files are additive except `program.ts`/`main.ts` wiring; a leftover `update-check.json` is harmless and needs no user action.

## Dependencies

- Published npm releases from the release pipeline (#27) so the registry `latest` tag is meaningful.

## Review Workload Forecast

Single PR, ~300-380 changed lines including tests (strict TDD). Strategy: ask-on-risk.

## Success Criteria (issue #49)

- [ ] Newer published version prints one stderr notice with version and upgrade hint; same/older prints nothing.
- [ ] Offline or slow registry never fails, blocks beyond the timeout, or changes exit code.
- [ ] Check runs at most once per 24h (fresh cache: no fetch; stale: fetch).
- [ ] Opt-out via `SHITAKU_NO_UPDATE_CHECK`, plus `CI` and non-TTY skips, are tested.
- [ ] `status --json` stdout is unchanged.
- [ ] README documents behavior and opt-out; `pnpm test`, typecheck, lint, format:check, build pass.
