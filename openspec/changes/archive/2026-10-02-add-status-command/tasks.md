# Tasks: Add `status` command (issue #45)

## Review Workload Forecast

| Field                   | Value                        |
| ----------------------- | ---------------------------- |
| Estimated changed lines | ~780 total (220 / 320 / 240) |
| 400-line budget risk    | High                         |
| Chained PRs recommended | Yes                          |
| Suggested split         | PR 1 -> PR 2 -> PR 3         |
| Delivery strategy       | ask-on-risk                  |
| Chain strategy          | pending                      |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Options: stacked-to-main, feature-branch-chain (PR2 base = PR1 branch, PR3 base = PR2 branch), size-exception.

### Suggested Work Units

| Unit | Goal                                               | Likely PR | Focused test command                                                                      | Runtime harness                          | Rollback boundary       |
| ---- | -------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------- |
| 1    | Classifier, `deriveOwnedItems`, `readPresent` move | PR 1      | `npx vitest run test/domain test/application/init-mcps.test.ts test/architecture.test.ts` | N/A: no caller yet                       | domain files + move     |
| 2    | `getStatus` use case                               | PR 2      | `npx vitest run test/application/status.test.ts`                                          | N/A: not wired to CLI                    | `application/status.ts` |
| 3    | CLI, renderers, `guarded()`, README                | PR 3      | `npx vitest run test/adapters/cli/program.test.ts`                                        | `shitaku status --json` in a tmp project | `program.ts`, README    |

## PR 1: Domain foundation

- [x] 1.1 RED: `test/domain/plan/status-plan.test.ts` covers all six states, `modified` over `out-of-date`, `missing` over all, `unreadable` -> `modified`, `unavailable` -> `unknown`
- [x] 1.2 GREEN: create `src/domain/plan/status-plan.ts` (types, `StatusItem`, `classifyStatus`)
- [x] 1.3 RED: `test/domain/manifest.test.ts` for `deriveOwnedItems`: undone excluded, newest wins with its `installId`, same name in two scopes kept apart
- [x] 1.4 GREEN: add `OwnedItem` and `deriveOwnedItems` to `src/domain/manifest.ts`; leave `deriveOwnership` untouched
- [x] 1.5 REFACTOR: move `readPresent` to `src/application/skill-tree.ts`, import it in `src/application/init-mcps.ts`; existing init tests and `test/architecture.test.ts` pass

## PR 2: getStatus use case

- [x] 2.1 RED: `test/application/status.test.ts` (tmp fs + folder catalog): installed, modified, out-of-date, missing, missing-from-catalog
- [x] 2.2 RED: scope filter, foreign config entries ignored, empty manifest, `ManifestError` rejects
- [x] 2.3 RED: symlinked skill -> `modified`; corrupt config file -> its items `modified` while other files classify normally
- [x] 2.4 RED: catalog load failure -> `unknown`, with `missing`/`modified` preserved; unsupported catalog MCP -> `missing-from-catalog`
- [x] 2.5 RED: no writes (fs spy rejects every write method)
- [x] 2.6 GREEN: create `src/application/status.ts` with `getStatus`, per-path config read once, unreadable mapping (`UnsafeTreeError`, `EACCES`/`EPERM`, `ConfigError`), sorted output
- [x] 2.7 REFACTOR: tidy helpers; all PR 2 tests pass

## PR 3: CLI, renderers, docs

- [x] 3.1 RED: `test/adapters/cli/program.test.ts` text output, `--scope`, degraded `catalog unavailable` header, `no managed items`
- [x] 3.2 RED: JSON shape (`version: 1`, `target`, `catalog`, item fields) with issues on stderr only; drift exits 0
- [x] 3.3 RED: corrupt manifest -> stderr `error:` and exit 1 for `status`, `init`, and `undo` (no stack trace)
- [x] 3.4 GREEN: add `ManifestError` to `guarded()` known errors in `src/adapters/cli/program.ts`
- [x] 3.5 GREEN: add `status [--scope] [--source] [--json]` command, renderers, `STATUS_JSON_VERSION = 1` in `src/adapters/cli/program.ts`
- [x] 3.6 Document `status`, states, `--json`, and the custom-source limitation in `README.md`
- [x] 3.7 Run full suite and `test/architecture.test.ts`
