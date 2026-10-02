# Verify Report: add-status-command (PR 1 only, tasks 1.1-1.5)

Verdict: PASS. CRITICAL 0, WARNING 1, SUGGESTION 1.

- pnpm test: 293/294; only test/tooling.test.ts "lint gate" timed out (5000ms) under parallel load. Rerun alone: 8/8 pass (flaky, not a regression).
- typecheck, lint, format:check: clean.
- classifyStatus (src/domain/plan/status-plan.ts:26-32) matches design.md:37 precedence exactly.
- deriveOwnedItems (src/domain/manifest.ts:108-127): undone excluded, newest wins with installId, key = scope+path+name, skills use item.root so listed once.
- readPresent moved unchanged to src/application/skill-tree.ts; init-mcps.ts imports it. deriveOwnership/deriveSkillOwnership untouched.
- Size: 189 added / 20 deleted non-openspec lines (~209), under 400.
- TDD evidence in apply-progress.md is complete (RED/GREEN/triangulate/refactor).

WARNING: test/tooling.test.ts:46 default 5s timeout flaky under full-suite parallelism.
SUGGESTION: src/domain/manifest.ts now imports a type from '@/ports' (domain -> ports, type-only); architecture test passes, but confirm intended.

---

# Verify Report: add-status-command (PR 2 only, tasks 2.1-2.7)

Verdict: PASS WITH WARNINGS. CRITICAL 0, WARNING 2, SUGGESTION 2. PR 3 tasks (3.x) intentionally unchecked, not counted.

- pnpm test: 313/313 pass (22 files). typecheck, lint, format:check: clean.
- Earlier flaky failure: most likely test/tooling.test.ts "lint gate" (default 5s timeout under parallel load), same as PR 1; not in status.test.ts, which has no timing dependence.
- Size: src/application/status.ts 127 + test/application/status.test.ts 243 = 370 lines (< 400).
- Tasks 2.1-2.7 all [x] and match code state.

## Spec compliance (install-status, PR 2 scope)

| Requirement / scenario                                                                               | Covering test                                           | Result                                                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Active items listed, fields, target                                                                  | "reports installed items..."                            | COMPLIANT                                                            |
| Undone install ignored                                                                               | deriveOwnedItems unit test (PR 1); no status-level test | COMPLIANT (indirect)                                                 |
| Same name in two scopes                                                                              | "lists both scopes by default..."                       | COMPLIANT                                                            |
| No writes                                                                                            | "never writes..." (writes rejected)                     | COMPLIANT                                                            |
| Default both / scope filter, reads only requested scope                                              | scope tests incl. "never reads the other scope"         | COMPLIANT                                                            |
| Item states (installed/modified/out-of-date/missing/missing-from-catalog), unrelated entries ignored | state tests + "ignores config entries..."               | COMPLIANT                                                            |
| Unsafe skill tree (symlink dir / symlink file) -> modified per item                                  | two symlink tests                                       | COMPLIANT                                                            |
| Corrupt config -> items modified, other file normal                                                  | corrupt config test                                     | COMPLIANT                                                            |
| Degraded catalog -> unknown, missing/modified preserved                                              | "reports unknown when catalog fails..."                 | COMPLIANT                                                            |
| Corrupt manifest rejects ManifestError                                                               | "rejects with ManifestError..."                         | COMPLIANT                                                            |
| Empty manifest                                                                                       | "returns no items..."                                   | COMPLIANT                                                            |
| Empty skill tree counts as absent                                                                    | none                                                    | UNTESTED (logic correct: status.ts:88-89, hash.ts treeHash([])=null) |
| EACCES/EPERM mapped to modified                                                                      | none                                                    | UNTESTED (status.ts:33-37)                                           |
| JSON / CLI / exit codes / --source                                                                   | PR 3                                                    | out of scope                                                         |

## Findings

CRITICAL: none.

WARNING

1. src/application/status.ts:33-37 and test/application/status.test.ts: EACCES/EPERM mapping and empty-skill-directory-as-absent have no covering test (spec says empty tree counts as absent). Strict TDD gap; behavior is correct by inspection.
2. src/application/status.ts:66-72: ENOTDIR (config parent path is a regular file) or EISDIR/ELOOP on a config path propagates and aborts the whole report, whereas the spec says an unreadable config must not abort. Only ConfigError/EACCES/EPERM are mapped, as design/task 2.6 prescribe, so this is a spec-vs-design gap, not a deviation.

SUGGESTION

1. status.ts:62-76 per-path config cache keyed by item.path only; safe today since serversKeyPath ignores scope in claude-code, but a target with scope-dependent key paths and a shared file would reuse the wrong entries. Key by path + scope.
2. Test "unknown" case (status.test.ts:123) does not cover an unknown-catalog skill that is unchanged ("demo unknown" scenario) separately from MCP; add an unchanged skill assertion.

## Correctness checks (no bug found)

- Hash comparison: MCP entry hash uses hashEntry(target.toEntry(mcp)) with placeholders verbatim, same as init (init-mcps.ts:262), so no false drift.
- Ordering/race: items evaluated sequentially; config promise cache creates rejections only when awaited, so no unhandled rejection; vanished file mid-read -> UnsafeTreeError -> modified.
- Read-only: only readText/listFiles/readBytes used.
- Sort deterministic (scope, kind, name, path). Scope filter applied before any disk read.
- Design: matches design.md precedence via classifyStatus.

---

# Verify Report: add-status-command (PR 3, tasks 3.1-3.7, plus final whole-change check)

Verdict: PASS WITH WARNINGS. CRITICAL 0, WARNING 2, SUGGESTION 2. Archive-ready. All 19 tasks are [x].

- pnpm test: 331/332; only test/tooling.test.ts "lint gate" timed out (5000ms). Rerun alone 3 times: 2 pass, 1 timeout (flaky, unrelated to this change; ESLint cold start).
- typecheck, lint, format:check, build, smoke:pack: clean.
- PR 3 size: README 25+/1-, program.ts 42+, program.test.ts 120+ = 188 changed lines (< 400).
- Strict TDD evidence present for PR 3 (RED 12 failed, GREEN 51/51, triangulated).

## Spec compliance (PR 3 / CLI layer)

| Requirement / scenario                                                             | Covering test (program.test.ts)                              | Result                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| Active items listed (kind, scope, state, path, target)                             | "lists items per scope..."                                   | COMPLIANT              |
| Scope filter / default both                                                        | "--scope", "lists items per scope"                           | COMPLIANT              |
| Empty manifest                                                                     | "no managed items", JSON empty                               | COMPLIANT              |
| Drift exits 0                                                                      | "reports drift and exits 0"                                  | COMPLIANT              |
| Catalog unavailable header, unknown, exit 0                                        | "prints catalog unavailable..." (+JSON variant)              | COMPLIANT              |
| JSON shape, version 1, catalog field, item fields                                  | "--json" x3                                                  | COMPLIANT              |
| stdout pure JSON, catalog issues on stderr                                         | "warns on stderr..."                                         | COMPLIANT              |
| Corrupt manifest: error:, exit 1, no stack, for status/init/undo                   | it.each x3                                                   | COMPLIANT              |
| Custom source limitation                                                           | README only (behavior covered by getStatus + --source tests) | COMPLIANT (documented) |
| Other scenarios (states, symlink, corrupt config, no writes, same name two scopes) | test/application/status.test.ts, status-plan.test.ts         | COMPLIANT (PR 1/2)     |

Whole change: every requirement and scenario in spec.md has a passing covering test.

## Issue #45 acceptance

- Lists installed items grouped by kind: PARTIAL, see W1.
- Drift reported without changing anything: met (no-writes test, drift test).
- Tests for installed/modified/missing: met.
- README documents it: met.

## README accuracy

States table matches classifyStatus (modified > out-of-date, missing wins). Exit-code, --json shape, stderr warnings, custom --source limitation, and init/undo corrupt-manifest claims all match tests. The stale "no list command" remark was removed.

## Findings

CRITICAL: none.

WARNING

1. src/adapters/cli/program.ts:178-186 (printStatus): text output groups by scope, then kind (sort scope, kind, name, path), with a `<scope> scope:` header; kind is shown only as a per-row suffix `(mcp)`/`(skill)`. Issue #45 says "grouped by kind". This matches spec.md (which requires only kind/scope on each item) and design.md:82, so it is an issue-vs-design divergence, not a spec violation. Within each scope, MCPs come before skills, so it is effectively kind-grouped inside a scope. Decide whether this is acceptable or the issue wording needs a note.
2. test/tooling.test.ts:46 lint gate keeps timing out at the default 5s (reproduced alone, 1 of 3). Pre-existing flake; full `pnpm test` can fail spuriously in CI. Raise the timeout.

SUGGESTION

1. Reports from PR 1 and PR 2 and this section are plain markdown; the sdd-verify-validate tool is not available here (`gentle-ai` has no such command), so no validator admission was run.
2. runStatus does not catch non-Manifest read errors; fine today, since guarded() handles known errors.
