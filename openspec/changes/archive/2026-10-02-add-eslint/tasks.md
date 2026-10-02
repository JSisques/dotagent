# Tasks: Add ESLint with typescript-eslint

## Review Workload Forecast

| Field                   | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| Estimated changed lines | 220-380 (lockfile excluded; violation fixes are the variable) |
| 400-line budget risk    | Medium                                                        |
| Chained PRs recommended | No                                                            |
| Suggested split         | Single PR                                                     |
| Delivery strategy       | ask-on-risk                                                   |
| Chain strategy          | pending                                                       |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

If the violation-fix count in 3.2 pushes the diff past 400, stop and ask for a split (PR 1 = Phases 1-2 tooling, PR 2 = Phase 3 fixes).

### Suggested Work Units

| Unit | Goal                                     | Likely PR | Focused test command                   | Runtime harness                                     | Rollback boundary              |
| ---- | ---------------------------------------- | --------- | -------------------------------------- | --------------------------------------------------- | ------------------------------ |
| 1    | Dual compiler + lint gate + hook + fixes | PR 1      | `pnpm vitest run test/tooling.test.ts` | `pnpm lint && pnpm run typecheck && pnpm run build` | Revert PR, regenerate lockfile |

## Phase 0: Confirm unverified design items

- [x] 0.1 Run `pnpm view eslint@10 engines peerDependencies` and `pnpm view typescript-eslint@^8.71.0 peerDependencies`; confirm `node -v` meets ESLint 10 (22.13+). Fall back to `eslint@^9` / `@eslint/js@^9` if rejected.
- [x] 0.2 Confirm `defineConfig` and `globalIgnores` exist in installed `eslint/config` and that `tseslint.config` is deprecated; use `defineConfig` only.
- [x] 0.3 DECIDED (default): OUT OF SCOPE. Add `pnpm run lint` to `.husky/pre-push` and `prepublishOnly`? Default OUT of scope (proposal); record the answer in the apply progress.

## Phase 1: RED (tests first)

- [x] 1.1 Create `test/fixtures/lint/floating-promise.ts` with an unawaited promise.
- [x] 1.2 Create `test/tooling.test.ts`: `typescript` major 6, `typescript-native` major 7; `typecheck`/`build` use `node_modules/typescript-native/bin/tsc` with no bare `tsc ` token; ESLint API (`ignore: false`) reports `@typescript-eslint/no-floating-promises`; every `eslint-disable` in `src`, `test`, `scripts` has `--`.
- [x] 1.3 Run `pnpm vitest run test/tooling.test.ts` and confirm RED (deps and config missing).

## Phase 2: GREEN (tooling)

- [x] 2.1 Edit `package.json` devDeps: `typescript@~6.0`, `typescript-native@npm:typescript@^7.0.2`, `eslint`, `@eslint/js`, `typescript-eslint@^8.71.0`, `eslint-config-prettier`, `globals`; run `pnpm install`.
- [x] 2.2 Edit `package.json` scripts: `typecheck`, `build` via explicit `typescript-native` path; add `lint`, `lint:fix`.
- [x] 2.3 Verify `pnpm run typecheck`, `pnpm run build` (incl. `scripts/check-dist-aliases.mjs`) pass on TS 7.
- [x] 2.4 Create `eslint.config.js` in design order: `globalIgnores`, recommended, `recommendedTypeChecked` with `projectService`, test override (justified only), `disableTypeChecked` + `globals.node` for js/mjs, `eslint-config-prettier` last.
- [x] 2.5 Edit `package.json` lint-staged: `"*.{ts,mjs,js}": ["eslint --fix","prettier --write"]`, catch-all `"!(*.{ts,mjs,js})"`.
- [x] 2.6 Re-run the tooling test; confirm GREEN.

## Phase 3: Existing violations (RED/GREEN on `pnpm lint`)

- [x] 3.1 Run `pnpm lint`; record the violation count per rule and directory.
- [x] 3.2 Fix violations in `src/**`, `test/**`, `scripts/*.mjs`; use `eslint-disable-next-line <rule> -- <reason>` only when a fix is not viable.
- [x] 3.3 Confirm `@/*` alias imports raise no project-service errors and `dist/` violations are not reported.

## Phase 4: Verification and cleanup

- [x] 4.1 Run `pnpm lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, `pnpm run format:check`; all exit 0.
- [x] 4.2 Manually stage a `.ts` file with an unfixable error and confirm the hook aborts the commit; stage an autofixable one and confirm it proceeds, with Prettier running once.
- [x] 4.3 Update `README.md` / `CLAUDE.md` scripts docs if they list commands (skip if absent).
- [x] 4.4 Count the diff excluding `pnpm-lock.yaml`; report against the 400-line budget.
