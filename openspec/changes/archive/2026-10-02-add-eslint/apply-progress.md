# Apply Progress: add-eslint

Mode: Strict TDD. Status: 19/19 tasks complete. Ready for verify.

## Decisions and confirmations

- 0.1: eslint 10.11.0 engines `^20.19.0 || ^22.13.0 || >=24`; local Node 26.7.0 OK. typescript-eslint 8.71.0 peers `eslint ^8.57||^9||^10`, `typescript >=4.8.4 <6.1.0` (hence TS `~6.0.3`). No fallback to eslint 9 needed.
- 0.2: `eslint/config` exports `defineConfig`, `globalIgnores`; `tseslint.config` is marked `@deprecated`. Config uses `defineConfig` only.
- 0.3: DECIDED (default) OUT OF SCOPE: lint is not added to `.husky/pre-push` or `prepublishOnly`.

## TDD Cycle Evidence

| Task    | Test File              | Layer        | Safety Net              | RED                                           | GREEN                    | TRIANGULATE                                                                   | REFACTOR |
| ------- | ---------------------- | ------------ | ----------------------- | --------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- | -------- |
| 1.1-1.3 | `test/tooling.test.ts` | Unit/tooling | N/A (new)               | Written; failed: cannot find package `eslint` | n/a                      | n/a                                                                           | n/a      |
| 2.1-2.6 | `test/tooling.test.ts` | Unit/tooling | 122 baseline tests pass | done                                          | 8/8 pass                 | typecheck/build scripts, fixture violation + clean file, disable scan + guard | Clean    |
| 3.1-3.2 | `pnpm lint` gate       | Gate         | 122 pass                | 50 errors (all in `test/`, none in `src/`)    | 0 errors, 122 tests pass | n/a                                                                           | Clean    |

## Violations (3.1)

50 errors, all under `test/`: no-unsafe-member-access 23, no-unsafe-assignment 11, no-unsafe-argument 6, require-await 5, no-unsafe-call 2, no-unused-vars 2, no-unsafe-return 1. Fixed with typed helper `test/helpers/parse-doc.ts`, `parseManifest`, `Promise.resolve/reject` stubs, and 2 inline disables with ` -- reason` (vitest asymmetric matchers typed any).

## Work Unit Evidence

| Evidence        | Value                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test    | `pnpm vitest run test/tooling.test.ts`: 8 passed                                                                                                                                                          |
| Runtime harness | `pnpm lint` 0; `pnpm run typecheck` 0; `pnpm test` 16 files / 122 tests pass; `pnpm run build` 0 (21 files clean); lint-staged: unfixable error aborts (exit 1), fixable proceeds (exit 0, prettier once) |
| Rollback        | Revert package.json, eslint.config.js, test changes, README; regenerate lockfile                                                                                                                          |

## Notes

- `pnpm run format:check` exits 1 only because of the untracked openspec/changes/add-eslint/\*.md artifacts (design, proposal, spec, tasks); pre-existing, outside code scope.
- Changed lines (lockfile excluded): 104 tracked (63+/41-) plus 131 in new files = 235; under the 400 budget.
- README.md updated (lint command, pre-commit row).
