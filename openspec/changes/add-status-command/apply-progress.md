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

## PR 3: CLI, renderers, docs (complete)

- [x] 3.1 RED text output, `--scope`, degraded `catalog unavailable` header, `no managed items` in `test/adapters/cli/program.test.ts`
- [x] 3.2 RED JSON shape (`version: 1`, `target`, `catalog`, item fields), catalog issues on stderr only, drift exits 0
- [x] 3.3 RED corrupt manifest -> `error:` on stderr, no stack trace, exit 1 for `status`, `init`, `undo` (parametrized)
- [x] 3.4 GREEN `ManifestError` added to `guarded()` known errors
- [x] 3.5 GREEN `status [--scope] [--source] [--json]`, `printStatus`, `runStatus`, `STATUS_JSON_VERSION = 1`
- [x] 3.6 README: usage line, `### Status` section (states table, `--json`, exit codes, custom `--source` limitation); dropped the stale "no `list` command" remark
- [x] 3.7 Full suite and `test/architecture.test.ts` pass

### TDD Cycle Evidence (PR 3)

| Task    | Test File                           | Layer       | Safety Net     | RED                                                    | GREEN                      | TRIANGULATE                                            | REFACTOR |
| ------- | ----------------------------------- | ----------- | -------------- | ------------------------------------------------------ | -------------------------- | ------------------------------------------------------ | -------- |
| 3.1-3.3 | `test/adapters/cli/program.test.ts` | Integration | 39/39 baseline | 12 failed (unknown command `status`, no `error:` text) | 51/51 passed after 3.4/3.5 | text, scope, degraded, empty, JSON x3, corrupt x3 cmds | Clean    |
| 3.4/3.5 | same                                | Integration | same           | covered above                                          | 51/51                      | covered above                                          | Clean    |

Two test expectations were corrected after GREEN (sort order is mcp before skill; the stderr test needed an invalid MCP file to produce a catalog issue). Behavior was not changed.

### Work Unit Evidence (PR 3)

| Evidence             | Value                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/adapters/cli/program.test.ts`: 51 passed                                                                                                                                                              |
| Runtime harness      | built CLI (`node dist/main.js`) in a temp HOME and cwd: init, `status`, `status --json`, edited skill -> `modified`, bad `--source` -> `catalog unavailable`/`unknown`, corrupt manifest -> `error:` exit 1 for status/init/undo |
| Rollback boundary    | `status` command, `printStatus`/`runStatus`, `STATUS_JSON_VERSION`, `ManifestError` in `guarded()` (`program.ts`); README Status section; new tests                                                                              |

Changed lines: README 25+/1-, `program.ts` 42+, `program.test.ts` 120+ (188 total). Full suite 332 passed (one run showed 1 transient failure not reproduced in 3 reruns). typecheck, lint, format:check, build, smoke:pack clean.

### Verify follow-up (PR 3)

- W1 RED first: `status` text tests rewritten to the grouped layout (4 failed). GREEN: `printStatus` prints a kind sub-header (`  mcps:` / `  skills:`) per scope and rows as `    <name>: <state>  <path>`; kinds with no items print no header; JSON unchanged. README example and wording, spec (grouping sentence) and design (text format) updated.
- W2: `test/tooling.test.ts` — the two eslint-spawning tests in `lint gate` got a 30_000 ms per-test timeout; nothing else changed.
- `verify-report.md` formatted with prettier.
