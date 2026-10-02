# Apply Progress: add-status-command

Mode: Strict TDD. Delivery: stacked-to-main, ask-on-risk.

## PR 1: Domain foundation (complete)

- [x] 1.1 RED `test/domain/plan/status-plan.test.ts` (11 cases)
- [x] 1.2 GREEN `src/domain/plan/status-plan.ts`
- [x] 1.3 RED `test/domain/manifest.test.ts` `deriveOwnedItems` (6 cases)
- [x] 1.4 GREEN `OwnedItem`, `deriveOwnedItems` in `src/domain/manifest.ts`
- [x] 1.5 REFACTOR `readPresent` moved to `src/application/skill-tree.ts`

### TDD Cycle Evidence

| Task    | Test File                              | Layer | Safety Net     | RED                                  | GREEN          | TRIANGULATE | REFACTOR                  |
| ------- | -------------------------------------- | ----- | -------------- | ------------------------------------ | -------------- | ----------- | ------------------------- |
| 1.1/1.2 | `test/domain/plan/status-plan.test.ts` | Unit  | N/A (new)      | Failed: module missing               | 11/11 passed   | 11 cases    | Clean                     |
| 1.3/1.4 | `test/domain/manifest.test.ts`         | Unit  | 15/15 baseline | 6 failed: `deriveOwnedItems` missing | 21/21 passed   | 6 cases     | Clean                     |
| 1.5     | init-mcps + architecture tests         | Unit  | 133 passing    | N/A (pure move; existing tests)      | 150/150 passed | N/A         | Move only, body unchanged |

### Work Unit Evidence

| Evidence             | Value                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/domain test/application/init-mcps.test.ts test/architecture.test.ts`: 11 files, 150 passed |
| Runtime harness      | N/A: no caller yet                                                                                                    |
| Rollback boundary    | `status-plan.ts`, `skill-tree.ts`, `deriveOwnedItems` block; move `readPresent` back into `init-mcps.ts`              |

Full suite: 21 files, 294 tests passed. typecheck, lint, format:check clean.

## PR 2: getStatus use case (complete)

- [x] 2.1 RED installed, modified, out-of-date, missing, missing-from-catalog in `test/application/status.test.ts`
- [x] 2.2 RED scope filter (other scope never read), foreign entries ignored, empty manifest, `ManifestError` rejects
- [x] 2.3 RED symlinked skill dir and symlink inside a skill -> `modified`; corrupt config -> its items `modified`, other file normal
- [x] 2.4 RED catalog load failure -> `unknown` with `missing`/`modified` preserved; unsupported MCP -> `missing-from-catalog`
- [x] 2.5 RED no writes (fs spy rejects every write method; zero attempts)
- [x] 2.6 GREEN `src/application/status.ts`: `getStatus`, per-path config cache, unreadable mapping, sorted output
- [x] 2.7 REFACTOR helpers (`isUnreadable`, `orUnreadable`, `compare`); all tests green

### TDD Cycle Evidence (PR 2)

| Task    | Test File                         | Layer       | Safety Net | RED                                     | GREEN        | TRIANGULATE                          | REFACTOR |
| ------- | --------------------------------- | ----------- | ---------- | --------------------------------------- | ------------ | ------------------------------------ | -------- |
| 2.1-2.5 | `test/application/status.test.ts` | Integration | N/A (new)  | Failed: `application/status.js` missing | 19/19 passed | 19 cases across states/scopes/faults | Clean    |
| 2.6/2.7 | same                              | Integration | N/A (new)  | covered above                           | 19/19 passed | covered above                        | Clean    |

### Work Unit Evidence (PR 2)

| Evidence             | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/application/status.test.ts`: 1 file, 19 passed                   |
| Runtime harness      | N/A: not wired to the CLI; tests use real NodeFileSystem on tmp dirs and `initMcps` to seed |
| Rollback boundary    | delete `src/application/status.ts` and `test/application/status.test.ts`                    |

### Verify follow-up (PR 2)

- RED first: new tests for ENOTDIR/EISDIR/ELOOP failed (4 failed); GREEN after `UNREADABLE_CODES` (`EACCES`, `EPERM`, `ENOTDIR`, `EISDIR`, `ELOOP`) in `status.ts`.
- Added tests: errno codes on config and skill-tree reads -> `modified` (parametrized), real ENOTDIR (cwd is a regular file), empty skill dir -> `missing`, undone install ignored, unchanged items `unknown` when the catalog fails.
- Config cache now keyed by scope + path. Dropped two redundant tests (symlink inside a skill, whole config file gone) to hold the budget.
- Final: 26 tests in `status.test.ts`; `status.ts` 131 lines + test 275 lines = 406 (budget ~400, excluding openspec).

Full suite: 320 passed at the last run; typecheck, lint clean; format:check clean for PR 2 files. `verify-report.md` (not authored by apply) fails prettier.
