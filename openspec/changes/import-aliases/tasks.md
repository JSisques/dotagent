# Tasks: `@/` and `@test/` import aliases (issue #12)

## Review Workload Forecast

| Field                   | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Estimated changed lines | PR 1: ~200-260; PR 2: ~250-330 (about 103 specifiers x2 plus Prettier reflow)       |
| 400-line budget risk    | Medium                                                                              |
| Chained PRs recommended | Yes                                                                                 |
| Suggested split         | PR 1 (wiring, scripts, direction guards, canary) -> PR 2 (codemod + no-`../` guard) |
| Delivery strategy       | auto-chain                                                                          |
| Chain strategy          | pending                                                                             |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                                                      | Likely PR | Focused test command                       | Runtime harness                       | Rollback boundary        |
| ---- | --------------------------------------------------------- | --------- | ------------------------------------------ | ------------------------------------- | ------------------------ |
| 1    | Alias wiring, dist guard, smoke, direction guards, canary | PR 1      | `npx vitest run test/architecture.test.ts` | `npm run build && npm run smoke:pack` | Revert PR 1 (after PR 2) |
| 2    | Codemod, Prettier, no-`../` guard                         | PR 2      | `npx vitest run test/architecture.test.ts` | `npm run build && npm run smoke:pack` | Revert PR 2 alone        |

## Phase 1: Spike (commit 1)

- [x] 1.1 Spike: add `paths` to `tsconfig.json`, `tsc-alias` devDep and Vitest alias in `vitest.config.ts`; convert one cross-layer `src` import and one `test` import (`@/`, `@test/helpers`). Run typecheck, test, build.
- [x] 1.2 tsc-alias ladder: plain, then `baseUrl` in `tsconfig.json`, then `tsconfig.alias.json`; if it cannot run on TS 7, BLOCK and escalate.
- [x] 1.3 Vitest ladder: regex alias, then `resolve.tsconfigPaths`, then inline `resolveId` plugin in `vitest.config.ts`.

## Phase 2: Wiring and scripts (commit 1)

- [x] 2.1 Create `scripts/check-dist-aliases.mjs` (fail on `@/`/`@test/` specifiers or empty `dist`; print `file:line`).
- [x] 2.2 Create `scripts/smoke-pack.mjs` (pack, temp install, `dotagent-cli --help`, `node dist/main.js --help`, no shell, cleanup in `finally`).
- [x] 2.3 Edit `package.json`: `build` chain with tsc-alias and dist guard, `smoke:pack`, append to `prepublishOnly`.

## Phase 3: Direction guards (commit 1)

- [x] 3.1 RED then GREEN in `test/architecture.test.ts`: scan `test/` too; `src` never imports `@test/`; `src/domain` never imports `@/adapters` or `@/application`. Specifier-anchored regex.
- [x] 3.2 Verify: `npm run typecheck`, `npx vitest run`, `npm run build`, `npm run smoke:pack` all green.

## Phase 4: Codemod (commit 2)

- [ ] 4.1 RED: add no-`../` specifier guard in `test/architecture.test.ts` (fails before codemod).
- [ ] 4.2 Count files with a `../` specifier before rewriting (design says 28, validator counted 27) and record the count.
- [ ] 4.3 Run one-off codemod (uncommitted) over `src/**/*.ts` and `test/**/*.ts`: rewrite `../` in import/export/side-effect/dynamic import/`vi.mock`; abort on out-of-tree targets; leave `./`, `new URL('../catalog/', ...)`, `join(import.meta.dirname, '..')`.
- [ ] 4.4 Run `prettier --write` on changed files; put the codemod command in the commit body.
- [ ] 4.5 Verify: typecheck, vitest (guard now GREEN), build, `smoke:pack`; confirm `src/main.ts` URL expression unchanged.

## Phase 5: Docs

- [x] 5.1 Edit `openspec/changes/import-aliases/proposal.md` commit list: no-`../` guard moves to commit 2; direction guards stay in commit 1.
