# Tasks: Add Prettier for Code Formatting

## Review Workload Forecast

| Field                   | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Estimated changed lines | Commit 1: ~35 (excl. lockfile). Commit 2: unknown, ~50-300 |
| 400-line budget risk    | Medium                                                     |
| Chained PRs recommended | No                                                         |
| Suggested split         | Single PR, two commits (chore, then style)                 |
| Delivery strategy       | ask-on-risk                                                |
| Chain strategy          | pending                                                    |

Decision needed before apply: No (becomes Yes only if task 2.4 measures > 400)
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                           | Likely PR       | Focused test command                                            | Runtime harness                             | Rollback boundary                           |
| ---- | ------------------------------ | --------------- | --------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 1    | Prettier tooling, docs, config | PR 1 (commit 1) | `npx prettier --check package.json .prettierrc .prettierignore` | `npm run format:check` lists pending files  | `git revert` the chore commit (after style) |
| 2    | One-time format pass           | PR 1 (commit 2) | `npm run format:check`                                          | `npm run format` then `git status` is clean | `git revert` the style commit alone         |

## Phase 1: Setup (commit 1: `chore: add prettier`)

- [x] 1.1 Run `npm i -D prettier@^3` to update `package.json` and `package-lock.json`.
- [x] 1.2 Create `.prettierrc` with printWidth 120, singleQuote true, semi true, trailingComma "all".
- [x] 1.3 Create `.prettierignore`: dist, node_modules, package-lock.json, coverage, .atl/, openspec/changes/archive/.
- [x] 1.4 Add `format` (`prettier --write .`) and `format:check` (`prettier --check .`) scripts after `test` in `package.json`; leave `files` untouched.
- [x] 1.5 Add the two format commands to the Development block in `README.md`.
- [x] 1.6 Set `testing.formatter: prettier` in `openspec/config.yaml`.
- [x] 1.7 Commit only these files as `chore: add prettier`; do not include the formatted output.

## Phase 2: Format pass (commit 2: `style: format codebase with prettier`)

- [x] 2.1 Baseline: run `npx prettier --check .` and record the files that would change.
- [x] 2.2 Run `npm run format` with no manual edits.
- [x] 2.3 Run `git diff --numstat`; group by `src/`+`test/`, `catalog/`, `openspec/`, root files.
- [x] 2.4 Budget = commit 1 + commit 2 additions + deletions, excluding `package-lock.json` (report it separately). If <= 400, go to 2.5. If > 400, STOP: `git restore .`, report the per-area breakdown, and ask. Recommended option: ignore `openspec/specs/` and `openspec/changes/`, amend commit 1, re-measure. Alternative: chained PRs.
- [x] 2.5 Commit as `style: format codebase with prettier`.

## Phase 3: Verification

- [x] 3.1 `npm run format:check` exits 0 (spec: Codebase is formatted).
- [x] 3.2 `npm run typecheck`, `npm run build`, `npm test` all exit 0 (spec: Existing quality gates pass).
- [x] 3.3 `git diff main -- package.json` shows only scripts and the devDependency, and no `files` change.
- [x] 3.4 `npm run format` then `git status --porcelain` is empty (spec: Style commit is pure).
- [x] 3.5 `git log --oneline` shows chore before style (spec: Config precedes formatting).
- [x] 3.6 Create a temporary unformatted file, confirm `format:check` fails naming it, then delete it. Create a temporary file under `dist/`, confirm it is ignored, then delete it.
