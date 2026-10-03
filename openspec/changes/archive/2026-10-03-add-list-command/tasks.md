# Tasks: Add a `list` command (issue #54)

## Review Workload Forecast

| Field                   | Value                                           |
| ----------------------- | ----------------------------------------------- |
| Estimated changed lines | 450-550 (about 160 src, 300 tests, 40 docs)     |
| 400-line budget risk    | Medium                                          |
| Chained PRs recommended | Yes                                             |
| Suggested split         | PR 1 (domain + use case) -> PR 2 (CLI + README) |
| Delivery strategy       | ask-on-risk                                     |
| Chain strategy          | stacked-to-main                                 |

Decision needed before apply: No (resolved: 2 chained PRs)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                        | Likely PR | Focused test command                                                                        | Runtime harness                             | Rollback boundary                               |
| ---- | --------------------------- | --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| 1    | Pure listing + use case     | PR 1      | `pnpm vitest run test/domain/catalog/listing.test.ts test/application/list-catalog.test.ts` | N/A: no CLI wiring, unreachable by users    | `listing.ts`, `list-catalog.ts` and their tests |
| 2    | `list` command, tests, docs | PR 2      | `pnpm vitest run test/adapters/cli/program.test.ts`                                         | `node dist/main.js list --json` after build | `program.ts` edits, CLI tests, README section   |

Note: task 1.1 is written first but lands in PR 2 (it fails without the command).

## Phase 1: Pin invalid kind (RED)

- [x] 1.1 In `test/adapters/cli/program.test.ts` add `describe('list')`: `list bogus` returns 1, stderr has `Allowed choices`, stdout empty (spec: Invalid kind).

## Phase 2: Domain (RED then GREEN)

- [x] 2.1 RED: create `test/domain/catalog/listing.test.ts`: three kinds mapped, kind-then-name sort, kind filter, case-insensitive name/description search, profile description `null`, `collapseWhitespace`.
- [x] 2.2 GREEN: create `src/domain/catalog/listing.ts` (`LIST_KINDS`, `CatalogEntry`, `collapseWhitespace`, `listEntries`).

## Phase 3: Application (RED then GREEN)

- [x] 3.1 RED: create `test/application/list-catalog.test.ts`: fake source passes items and issues through; rejected `load()` becomes `CatalogLoadError` with original message.
- [x] 3.2 GREEN: create `src/application/list-catalog.ts` (`listCatalog`, `ListReport`, `CatalogLoadError`).

## Phase 4: CLI (RED then GREEN, by group)

- [x] 4.1 RED: text output via `--source` fixture: exact aligned lines, name-only profile, collapsed multi-line description, kind filter, `--search` (name, description, combined with kind), `no matching items` exit 0; one bundled-catalog structure smoke test.
- [x] 4.2 GREEN: in `src/adapters/cli/program.ts` add `list` command with `Argument('[kind]').choices(LIST_KINDS)`, `runList`, `printList`. Makes 1.1 and 4.1 pass.
- [x] 4.3 RED: `--json` tests: single document, `version: 1`, sorted flat items, `description: null`, empty `items: []`; skipped entry warns on stderr while stdout parses.
- [x] 4.4 GREEN: add `LIST_JSON_VERSION` and JSON branch plus `warning: skipped <file>: <reason>` stderr output in `runList`.
- [x] 4.5 RED: missing folder and malformed `catalog.json` exit 1 with `error: cannot load catalog from <where>: <msg>`; same name as MCP and skill appears in both groups; `tmp.cwd` and `tmp.homeDir` stay empty.
- [x] 4.6 GREEN: catch `CatalogLoadError` in `runList` (other errors propagate via `guarded()`).
- [x] 4.7 REFACTOR: tidy `program.ts` and tests; confirm `test/architecture.test.ts` passes.

## Phase 5: Docs

- [x] 5.1 `README.md`: usage line, `### List` section, JSON shape table (additive-change note, like `status`).

## Phase 6: Verification

- [x] 6.1 Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`, `pnpm run build`; all green.
