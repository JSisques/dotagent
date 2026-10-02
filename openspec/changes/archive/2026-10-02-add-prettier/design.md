# Design: Add Prettier for Code Formatting

## Technical Approach

Tooling-only change, no hexagonal layer gains or loses a dependency. Add Prettier 3.x as a devDependency with a JSON config, an ignore file, two npm scripts, README docs, and `openspec/config.yaml` metadata. Deliver as two commits: setup first, then a pure `npm run format` output commit. Apply measures the real diff before committing the format pass and stops if the budget is exceeded.

## Architecture Decisions

| Topic                | Option / tradeoff                                                                                                                            | Decision                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Config format        | `.prettierrc` (JSON, no runtime) vs `prettier.config.js` (ESM, executable, overkill) vs `package.json` key (mixes concerns)                  | `.prettierrc` JSON                                                        |
| Version              | `^3` caret vs exact pin. Prettier 3 needs Node >=14, ships its own TS parser (independent of project `typescript@^7`), has zero runtime deps | `prettier@^3` via `npm i -D prettier`; lockfile pins the resolved version |
| Options              | Only the 4 confirmed; defaults kept for `tabWidth: 2`, `endOfLine: lf`, `proseWrap: preserve` (no Markdown rewrapping)                       | Explicit 4 keys only                                                      |
| Scope of formatting  | Format everything not ignored (TS, JSON, YAML, Markdown) vs TS-only glob                                                                     | Everything; `.` keeps `format:check` simple and matches proposal          |
| Ignore list          | Confirmed list; `catalog/` and `openspec/specs/` stay formatted unless budget forces otherwise                                               | Confirmed list only                                                       |
| Commit split         | Single commit vs two                                                                                                                         | Two: `chore: add prettier`, `style: format codebase with prettier`        |
| Over-budget handling | Silently ignore more paths vs stop and ask                                                                                                   | Stop and ask (ask-on-risk); present per-area breakdown                    |

## Data Flow

    npm run format ──→ prettier reads .prettierrc + .prettierignore
                          │
                          └──→ rewrites src/ test/ catalog/ openspec/ README ...
    npm run format:check ──→ exit 0 (clean) | exit 1 (lists files)

## File Changes

| File                                                                    | Action | Description                                                                   |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `.prettierrc`                                                           | Create | 4 confirmed options                                                           |
| `.prettierignore`                                                       | Create | Confirmed ignore list                                                         |
| `package.json`                                                          | Modify | `prettier` devDependency, `format`, `format:check` scripts; `files` untouched |
| `package-lock.json`                                                     | Modify | Prettier entry (~10-15 lines, excluded from budget)                           |
| `README.md`                                                             | Modify | Development block gains format commands                                       |
| `openspec/config.yaml`                                                  | Modify | `testing.formatter: prettier`                                                 |
| `src/**`, `test/**`, `catalog/**`, `openspec/**/*.md`, `*.json`, `*.md` | Modify | Commit 2 only: Prettier output                                                |

## Interfaces / Contracts

`.prettierrc`:

```json
{
  "printWidth": 120,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all"
}
```

`.prettierignore`:

```
dist
node_modules
package-lock.json
coverage
.atl/
openspec/changes/archive/
```

Scripts (inserted after `test`):

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

README Development block becomes:

```sh
npm install
npm run typecheck
npm test
npm run build
npm run format        # rewrite files with Prettier
npm run format:check  # fail if any file is not formatted
```

## Diff Measurement Procedure (apply)

1. After commit 1, run `npx prettier --check .` and record the list of files that would change (baseline evidence).
2. Run `npm run format`, then `git diff --stat` and `git diff --numstat`.
3. Budget = sum of additions + deletions from commit 1 and commit 2, excluding `package-lock.json`. Report lockfile lines separately.
4. Group numstat totals by area: `src/`+`test/`, `catalog/`, `openspec/`, root files.
5. If total <= 400: commit 2. If > 400: do NOT commit; `git restore` the formatted files, report the per-area breakdown, and ask. Recommended option to offer: add `openspec/specs/` and `openspec/changes/` (Markdown table realignment is the most likely churn source) to `.prettierignore`, amend commit 1, and re-measure. Chained PRs are the alternative.

Churn notes: Markdown tables get padded/realigned and `*` bullets become `-`; JSON in `catalog/` is likely already 2-space formatted; YAML is low risk. `proseWrap: preserve` prevents paragraph rewrapping.

## Testing Strategy

| Layer            | What to Test                                  | Approach                                                         |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Static           | Formatting clean                              | `npm run format:check` exits 0                                   |
| Static           | No type regressions                           | `npm run typecheck`                                              |
| Unit/Integration | Behavior unchanged, catalog JSON still parses | `npm test` (existing Vitest suite)                               |
| Build            | Emit works                                    | `npm run build`                                                  |
| Packaging        | `files` unchanged                             | `git diff main -- package.json` shows only scripts/devDependency |

No new tests: formatting is semantics-preserving and existing suites cover catalog loading.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. npm scripts invoke a local dev tool only.

## Migration / Rollout

No migration required. Rollback: `git revert` the `style:` commit, then the `chore:` commit (or revert the merged PR). No published-artifact impact: Prettier is a devDependency and `files` is unchanged.

## Open Questions

- [ ] None blocking. Over-budget path is resolved by ask-on-risk at apply time.
