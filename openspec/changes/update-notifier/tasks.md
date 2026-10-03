# Tasks: Update notifier (issue #49)

## Review Workload Forecast

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| Estimated changed lines | ~380-430 (about 260 for PR 1, 150 for PR 2)  |
| 400-line budget risk    | Medium                                       |
| Chained PRs recommended | Yes                                          |
| Suggested split         | PR 1 (domain, port, use case) -> PR 2 (rest) |
| Delivery strategy       | ask-on-risk                                  |
| Chain strategy          | pending                                      |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                              | Likely PR | Focused test command                                                                    | Runtime harness                                        | Rollback boundary                               |
| ---- | --------------------------------- | --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| 1    | Domain rules, port, use case      | PR 1      | `pnpm exec vitest run test/domain/update.test.ts test/application/check-update.test.ts` | N/A: unwired, covered by sandboxed use-case tests      | Revert the 3 new src files and 2 tests          |
| 2    | npm adapter, CLI, main.ts, README | PR 2      | `pnpm exec vitest run test/adapters`                                                    | Manual registry URL check, then run built CLI in a TTY | Revert adapter, `program.ts`, `main.ts`, README |

## Phase 1: Domain (PR 1)

- [x] 1.1 RED: `test/domain/update.test.ts` with `it.each` tables for `isNewer`, `isStale`, `isTruthyFlag`, `parseUpdateCache`, `updateNotice`.
- [x] 1.2 GREEN: create `src/domain/update.ts` (zod only) until 1.1 passes.
- [x] 1.3 REFACTOR: tidy regex and constants; rerun domain tests and `test/architecture.test.ts`.

## Phase 2: Port and use case (PR 1)

- [x] 2.1 Create `src/ports/version-source.ts` (`LatestVersionSource`).
- [x] 2.2 RED: `test/application/check-update.test.ts` with `NodeFileSystem` on `makeTmpPaths()`, fake source, fixed `now`. Cases: opt-out, CI, non-TTY (no read/fetch/write); fresh cache; stale, absent and corrupt (fetch + write); offline keeps old `latest`; source throws; fs throws; slow source honors `timeoutMs`.
- [x] 2.3 GREEN: create `src/application/check-update.ts` (`updateCachePath`, `checkForUpdate`, never rejects).
- [x] 2.4 REFACTOR: dedupe; rerun `pnpm run typecheck`, `pnpm run lint`.

## Phase 3: npm adapter (PR 2)

- [ ] 3.1 RED: `test/adapters/npm/registry-version-source.test.ts` with fake `fetchFn`: URL `@jsisques%2Fshitaku/latest`, ok payload, non-ok, bad JSON, schema miss, rejected fetch, abort.
- [ ] 3.2 GREEN: create `src/adapters/npm/registry-version-source.ts`.

## Phase 4: CLI wiring (PR 2)

- [ ] 4.1 RED: extend `test/adapters/cli/program.test.ts`: notice on stderr after command; none when same version; `status --json` stdout unchanged; exit code unchanged (including failing command); no `updates` means no check.
- [ ] 4.2 GREEN: modify `src/adapters/cli/program.ts` (`UpdateSettings`, start before dispatch, await after, print via `deps.err`).
- [ ] 4.3 Modify `src/main.ts`: read version via `readFileSync(new URL('../package.json', import.meta.url))`, compute `interactive` (stdout and stderr TTY), wire adapter; omit `updates` if version unreadable.
- [ ] 4.4 REFACTOR; confirm `test/naming.test.ts` and `test/architecture.test.ts` still pass.

## Phase 5: Docs and verification (PR 2)

- [ ] 5.1 Modify `README.md`: "Update notifications" section (notice, 24h cache, `CI` and non-TTY skips, `SHITAKU_NO_UPDATE_CHECK` values `1`/`true`/`yes`, stderr only).
- [ ] 5.2 Manual: `curl -s 'https://registry.npmjs.org/@jsisques%2Fshitaku/latest'` returns JSON with `version`.
- [ ] 5.3 Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`, `pnpm run build`; all green.
- [ ] 5.4 Conventional commits per unit, no AI attribution.
