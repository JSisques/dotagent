# Proposal: Add Prettier for Code Formatting

## Intent

The repo has no formatter, so style is enforced by convention only. Issue #10 adds Prettier so formatting is deterministic and checkable. It must land before the Husky and import-alias issues, which depend on a stable formatting baseline.

## Scope

### In Scope

- Add `prettier` devDependency and scripts `format` (`prettier --write .`) and `format:check` (`prettier --check .`).
- `.prettierrc`: `printWidth: 120`, `singleQuote: true`, `semi: true`, `trailingComma: "all"`.
- `.prettierignore`: `dist`, `node_modules`, `package-lock.json`, `coverage`, `.atl/`, `openspec/changes/archive/`.
- README Development section documents the format commands.
- `openspec/config.yaml`: `testing.formatter: null` -> `prettier`.
- One-time formatting pass as its own commit.

### Out of Scope

- Husky / lint-staged / pre-commit hooks (separate issue).
- Import aliases (separate issue).
- ESLint or CI workflow.
- `.git-blame-ignore-revs` (optional follow-up).
- Changes to `package.json` `files`.

## Capabilities

### New Capabilities

None

### Modified Capabilities

None

Tooling-only change; no spec-level behavior changes.

## Approach

Two commits on one branch/PR:

1. `chore: add prettier` — config, ignore file, scripts, devDependency, README, `openspec/config.yaml`.
2. `style: format codebase with prettier` — output of `npm run format` only, no manual edits.

Apply must measure, not trust the estimate: run `npx prettier --check .` and `git diff --stat` after formatting and confirm the total stays under 400 changed lines.

## Affected Areas

| Area                                | Impact   | Description                                                                  |
| ----------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `package.json`, `package-lock.json` | Modified | devDependency and scripts                                                    |
| `.prettierrc`, `.prettierignore`    | New      | Formatter config                                                             |
| `README.md`                         | Modified | Development commands                                                         |
| `openspec/config.yaml`              | Modified | `testing.formatter`                                                          |
| `src/**`, `test/**`                 | Modified | Formatting only (all hexagonal layers touched cosmetically; no logic change) |

## Risks

| Risk                                                                                                                              | Likelihood | Mitigation                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Format diff exceeds 400 lines (estimate unverified; Markdown/JSON/YAML in `openspec/specs`, `catalog`, README also get formatted) | Med        | Measure with `git diff --stat`; if over budget, stop and ask (ask-on-risk) |
| Formatting changes behavior                                                                                                       | Low        | typecheck, build, vitest after pass                                        |
| Catalog JSON/YAML reformat affects runtime parsing                                                                                | Low        | Tests cover catalog loading; formatting is semantics-preserving            |

## Rollback Plan

Revert the `style:` commit, then the `chore:` commit (or revert the merged PR). No runtime or published-artifact impact.

## Dependencies

- `prettier` (npm devDependency, latest 3.x).

## Success Criteria

- [ ] `npm run format:check` passes.
- [ ] `npm run typecheck`, `npm run build`, `npm test` pass.
- [ ] Formatting pass is isolated in commit `style: format codebase with prettier`.
- [ ] `package.json` `files` unchanged.
- [ ] PR diff under 400 changed lines (excluding `package-lock.json` churn noted separately).
