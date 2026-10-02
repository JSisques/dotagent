# Tasks: Add Husky Git Hooks (Issue #11)

## Review Workload Forecast

| Field                   | Value                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~60 hand-written; plus generated `package-lock.json` churn (not hand-reviewed, `size:exception`-style generated diff) |
| 400-line budget risk    | Low (hand-written); lockfile is generated                                                                             |
| Chained PRs recommended | No                                                                                                                    |
| Suggested split         | Single PR                                                                                                             |
| Delivery strategy       | auto-chain                                                                                                            |
| Chain strategy          | pending (not needed; single PR)                                                                                       |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                   | Likely PR | Focused test command                             | Runtime harness               | Rollback boundary                                   |
| ---- | -------------------------------------- | --------- | ------------------------------------------------ | ----------------------------- | --------------------------------------------------- |
| 1    | Husky hooks, configs, `.nvmrc`, README | PR 1      | `npm run typecheck && npm test && npm run build` | Manual smoke checks (Phase 3) | Revert PR, then `git config --unset core.hooksPath` |

## Phase 1: Foundation

- [x] 1.1 `npm install -D husky@^9 lint-staged@^17 @commitlint/cli@^21 @commitlint/config-conventional@^21` (updates `package.json`, `package-lock.json`).
- [x] 1.2 Confirm lint-staged/commitlint `engines` from `node_modules/*/package.json` match 22.22.1 / 22.12 (design open question); adjust `.nvmrc` and README if not.
- [x] 1.3 Add `"prepare": "husky"` and `"lint-staged": { "*": "prettier --write --ignore-unknown" }` to `package.json`; keep `engines.node` `>=22`.
- [x] 1.4 Create `.nvmrc` containing `22.22.1`.

## Phase 2: Hooks and Config

- [x] 2.1 Create `commitlint.config.js`: `export default { extends: ['@commitlint/config-conventional'] };`
- [x] 2.2 Create `.husky/pre-commit`: `npx --no -- lint-staged` (no shebang).
- [x] 2.3 Create `.husky/commit-msg`: `npx --no -- commitlint --edit "$1"`.
- [x] 2.4 Create `.husky/pre-push`: `npm run typecheck`, `npm run test:changed`, `npm run build` on separate lines. Also add script `"test:changed": "vitest run --changed origin/main --passWithNoTests"` to `package.json`.
- [x] 2.5 Run `git update-index --chmod=+x .husky/pre-commit .husky/commit-msg .husky/pre-push` after staging.
- [x] 2.6 Extend `## Development` in `README.md`: Node `>=22.22.1` (`nvm use`), hooks table, bypass (`--no-verify`, `HUSKY=0`).

## Phase 3: Verification (manual smoke, no Vitest tests added)

- [x] 3.1 `git config core.hooksPath` returns `.husky/_` after install.
- [x] 3.2 `git ls-files -s .husky` shows `100755` for all three hooks.
- [x] 3.3 Partial-staged commit: stage part of an unformatted `.ts` file; commit; staged hunks are formatted and unstaged hunks are preserved (threat matrix: commit state).
- [x] 3.4 `echo "update stuff" | npx commitlint` exits non-zero; `feat: add hooks` passes; `HUSKY=0` commit bypasses.
- [x] 3.5 First push on a branch with no upstream runs typecheck, test:changed, build (threat matrix: push state); an injected type error blocks the push; a failing changed test blocks it; an unrelated test is skipped; a docs-only push passes with no tests.
- [x] 3.6 `npm pack --dry-run` lists no `.husky`, `commitlint.config.js`, or `.nvmrc`.
- [x] 3.7 Regression: `npm run typecheck && npm test && npm run build` is green.

## Phase 4: Delivery

- [x] 4.1 Commit with conventional messages (for example `chore: add husky git hooks`, `docs: document git hooks`); no AI attribution.
