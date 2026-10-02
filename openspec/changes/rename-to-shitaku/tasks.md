# Tasks: Rename dotagent to shitaku

## Review Workload Forecast

| Field                   | Value                                           |
| ----------------------- | ----------------------------------------------- |
| Estimated changed lines | ~120-180 (code/tests/docs, lockfile name lines) |
| 400-line budget risk    | Low                                             |
| Chained PRs recommended | No                                              |
| Suggested split         | Single PR                                       |
| Delivery strategy       | ask-on-risk                                     |
| Chain strategy          | pending                                         |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                              | Likely PR | Focused test command                      | Runtime harness                     | Rollback boundary                    |
| ---- | --------------------------------- | --------- | ----------------------------------------- | ----------------------------------- | ------------------------------------ |
| 1    | Guard test + literal rename       | PR 1      | `npx vitest run test/naming.test.ts`      | `npm run smoke:pack`                | Revert the PR (no state migration)   |
| 2    | Engram migration (USER-CONFIRMED) | none      | `mem_search` for one migrated observation | `mem_current_project` shows shitaku | Separate runbook; not part of the PR |

## Phase 0: USER-ONLY (out of apply scope)

- [ ] 0.1 USER-ONLY: run `gh repo rename shitaku`.
- [ ] 0.2 USER-ONLY: run `git remote set-url origin https://github.com/JSisques/shitaku`.
- [ ] 0.3 USER-ONLY (optional): rename the local project directory.

## Phase 1: RED guard test

- [x] 1.1 Create `test/naming.test.ts`: fs walk (no git) of src, test, scripts, catalog, openspec/config.yaml, README.md, package.json, package-lock.json; fail on `/dotagent/i` built as `['dot','agent'].join('')`; exclude openspec/changes/\*\* and openspec/specs (the live specs are updated by sdd-archive, then checked with rg).
- [x] 1.2 In the same file assert package name `@jsisques/shitaku`, bin key `shitaku`, and `runCli --help` prints `Usage: shitaku`. Run it; confirm RED.

## Phase 2: Rename (GREEN)

- [x] 2.1 `src/application/journal.ts`: `stateDir()` literal to `.claude/.shitaku` (single source).
- [x] 2.2 `src/infrastructure/node-fs.ts` and `src/cli/program.ts`: rename literals; program name `shitaku`.
- [x] 2.3 `src/domain/plan/change-plan.ts`: reason string "installed by shitaku".
- [x] 2.4 `src/domain/manifest.ts`: update comments.
- [x] 2.5 `test/setup.ts` and `test/architecture.test.ts` together: HOME prefix to `shitaku-home-`.
- [x] 2.6 `test/helpers/tmp-paths.ts` prefix; `test/application/init-mcps.test.ts` title.
- [x] 2.7 `scripts/smoke-pack.mjs`: derive name and first bin key from package.json; run `shitaku --help`.
- [x] 2.8 `package.json`: name `@jsisques/shitaku`, bin `shitaku` only, repository `https://github.com/JSisques/shitaku`.
- [x] 2.9 Regenerate `package-lock.json` via `npm install --package-lock-only`.
- [x] 2.10 `README.md` and `openspec/config.yaml`: rename all mentions.
- [x] 2.11 Fix any remaining hits from `rg -i dotagent -g '!openspec/changes/**' -g '!openspec/specs/**'` (archive untouched; `openspec/specs` is updated by sdd-archive, not apply).

## Phase 3: Verification

- [x] 3.1 `npx prettier --write openspec/changes/rename-to-shitaku`.
- [x] 3.2 Run `npm run build`, `npm test` (guard now GREEN), typecheck, `npm run format:check`.
- [x] 3.3 Run `npm run smoke:pack` (packed `shitaku --help` exits 0).
- [x] 3.4 `rg -i dotagent -g '!openspec/changes/**'` returns no matches.

## Phase 4: Engram migration runbook (USER-CONFIRMED, post-merge, separate workstream)

- [ ] 4.1 Check `engram projects rescue-ownership --help` for exact flags; confirm `mem_current_project` shows shitaku.
- [ ] 4.2 Trial-move ONE observation; verify via `mem_search`.
- [ ] 4.3 On success, bulk move the rest, recording moved IDs.
- [ ] 4.4 Fallback if trial fails: fresh `sdd-init` under shitaku. Never hand-edit SQLite.
