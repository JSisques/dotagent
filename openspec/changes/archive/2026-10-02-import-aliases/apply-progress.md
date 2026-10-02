# Apply Progress: import-aliases

## PR 1 (branch feat/import-aliases-wiring, stacked-to-main) - Mode: Standard (strict_tdd: false)

Completed: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 5.1. Pending: Phase 4 (4.1-4.5, PR 2).

## Spike outcome

- tsc-alias ladder: rung 1 (works as-is). `tsc-alias -p tsconfig.build.json` rewrites `dist` under TS 7.0.2 with `paths` only; no `baseUrl` and no `tsconfig.alias.json` needed. Typecheck also passes without `baseUrl`.
- Vitest ladder: rung 1 (regex `resolve.alias`, `.js` -> `.ts` through the alias works on Vitest 5.0.3).
- Canaries: `src/application/undo-install.ts` (`@/domain/hash.js`, a value import, so tsc-alias is really exercised; dist shows `../domain/hash.js`), `src/domain/plan/change-plan.ts` (`@/ports/paths.js`, type-only so elided from dist), `test/application/journal.test.ts` (`@test/helpers/tmp-paths.js`).
- Files containing a `../` specifier before codemod: 27 (`rg -l "\.\./" src test`; design said 28).

## Work Unit Evidence

| Evidence          | Result                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `npx vitest run test/architecture.test.ts`: 8 passed. RED proven first: injecting `@test/` into src and `@/adapters` into domain failed 2 guards, then reverted.                                                        |
| Runtime harness   | `npm run build` (guard: 21 files clean) and `npm run smoke:pack` (both `dotagent-cli --help` and `node dist/main.js --help` ok). Guard negative checks: injected `@/x.js` exits 1 with file:line; missing dist exits 1. |
| Full suite        | `npm run typecheck` ok; `npx vitest run` 14 files, 110 tests passed.                                                                                                                                                    |
| Rollback boundary | Revert the PR 1 commit; tsconfig/vitest/package.json/scripts/architecture test and 3 canary imports.                                                                                                                    |

## Notes

- Task 3.2 baseline `format:check` warns only for untracked openspec artifacts at the time; prettier applied afterwards.

## PR 2 (branch feat/import-aliases-codemod, stacked on feat/import-aliases-wiring) - Mode: Standard

Completed: 4.1, 4.2, 4.3, 4.4, 4.5. All tasks done (PR 1: 1.1-1.3, 2.x, 3.x, 5.1).

- Pre-codemod count: 26 files / 90 specifiers with a real `../` specifier (`rg -l "\.\./" src test` gives 27 because `src/main.ts` has the `new URL('../catalog/', ...)` expression, which is untouched).
- RED: no-`../` guard failed before codemod (1 failed, 8 passed); GREEN after.
- Codemod: one-off script (uncommitted, scratchpad) rewriting `from`/`import(`/side-effect `import`/`vi.mock` specifiers starting with `../`; src targets -> `@/`, test targets -> `@test/`; abort on out-of-tree. Result: 90 specifiers in 26 files. Prettier then ran on those files.
- Verification: `npm run typecheck` ok; `npx vitest run` 14 files, 111 tests passed; `npm run build` ok (dist guard 21 files clean); `npm run smoke:pack` ok (both checks); `rg -n "from '\.\./|import\('\.\./" src test` empty; `prettier --check src test` clean; `src/main.ts` unchanged.
- Rollback boundary: revert the PR 2 commit(s) alone.
