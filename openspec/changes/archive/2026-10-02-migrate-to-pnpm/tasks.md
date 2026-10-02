# Tasks: Migrate developer tooling from npm to pnpm

## Review Workload Forecast

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Estimated changed lines | ~80-120 authored (lockfile and deleted package-lock.json excluded) |
| 400-line budget risk    | Low                                                                |
| Chained PRs recommended | No                                                                 |
| Suggested split         | Single PR                                                          |
| Delivery strategy       | ask-on-risk                                                        |
| Chain strategy          | pending                                                            |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                    | Likely PR | Focused test command                          | Runtime harness       | Rollback boundary                                    |
| ---- | ----------------------- | --------- | --------------------------------------------- | --------------------- | ---------------------------------------------------- |
| 1    | Full npm to pnpm switch | PR 1      | `pnpm install --frozen-lockfile && pnpm test` | `pnpm run smoke:pack` | Revert PR, then `rm -rf node_modules && npm install` |

## Phase 1: Lockfile and pin (order matters)

- [x] 1.1 Run `corepack enable`, then `corepack pnpm@10 import` to create `pnpm-lock.yaml` from `package-lock.json`.
- [x] 1.2 Run `corepack use pnpm@10` to add `packageManager` to `package.json` (after 1.1); record the exact version.
- [x] 1.3 Delete `package-lock.json`; run `pnpm install`, note any "Ignored build scripts" warning.

## Phase 2: Config and scripts

- [x] 2.1 `package.json`: `prepublishOnly` -> `pnpm run typecheck && pnpm run test && pnpm run build && pnpm run smoke:pack`.
- [x] 2.2 `.prettierignore`: replace `package-lock.json` with `pnpm-lock.yaml`.
- [x] 2.3 `.husky/pre-commit`: `pnpm exec lint-staged`.
- [x] 2.4 `.husky/commit-msg`: `pnpm exec commitlint --edit "$1"`.
- [x] 2.5 `.husky/pre-push`: `pnpm run typecheck`, `pnpm run test:changed`, `pnpm run build`.
- [x] 2.6 `scripts/smoke-pack.mjs`: line 2 comment and line 34 error `npm run build` -> `pnpm run build`; keep npm pack/install logic.
- [x] 2.7 Only if 1.3 warned AND a verify command fails: add `pnpm.onlyBuiltDependencies` in `package.json`. (Not needed: no ignored-build warning surfaced and all verify commands passed.)

## Phase 3: Docs

- [x] 3.1 `README.md`: Development block to pnpm; corepack setup note (Node 25+ needs `npm i -g corepack`); "hooks installed by `pnpm install`"; hooks table; smoke-pack npm exception. Keep lines 3 and 9 (`npx`).
- [x] 3.2 `openspec/config.yaml`: `strict_tdd_note`, `testing.command`, `type_checker`, `formatter`, `rules.verify` -> `pnpm test`, `pnpm run typecheck`, `pnpm run format:check`; keep context line 3.

## Phase 4: Verification

- [x] 4.1 `rm -rf node_modules && pnpm install --frozen-lockfile`; confirm `.husky/_` exists.
- [x] 4.2 `pnpm run typecheck`, `pnpm test`, `pnpm run build`; fix phantom deps with explicit devDependencies, never `shamefully-hoist`.
- [x] 4.3 Hooks: `echo "bad" | pnpm exec commitlint` fails; misformatted staged file is formatted; `git push --dry-run` triggers pre-push.
- [x] 4.4 `pnpm run smoke:pack` passes.
- [x] 4.5 `pnpm run format:check` passes; lockfile not reported.
- [x] 4.6 `rg -n 'npm (run|install|test)|npx --no' README.md .husky package.json openspec/config.yaml scripts` shows only smoke-pack npm logic and consumer `npx` lines.
- [x] 4.7 Confirm `package-lock.json` absent and `pnpm-lock.yaml` present.
