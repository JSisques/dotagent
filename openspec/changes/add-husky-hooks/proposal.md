# Proposal: Add Husky Git Hooks (Issue #11)

## Intent

No CI exists, so formatting, type errors, failing tests, and non-conventional commit messages reach `main` unchecked. Local Git hooks give fast, enforced feedback before code leaves the machine.

## Scope

### In Scope

- Husky 9 with `"prepare": "husky"` script
- `pre-commit`: lint-staged running Prettier on staged files
- `commit-msg`: commitlint with `@commitlint/config-conventional` (user-confirmed)
- `pre-push`: `npm run typecheck`, `npx vitest run`, `npm run build`
- `.nvmrc` pinning the contributor Node version (22.22.1+)
- README "Development" section: hooks, Node requirement, bypass (`--no-verify`, `HUSKY=0`)

### Out of Scope

- CI workflows (GitHub Actions)
- ESLint or other linters
- Raising `engines.node` for package consumers

## Capabilities

### New Capabilities

- `git-hooks`: contributor-side hook behavior (install on `npm install`, pre-commit formatting, commit-message validation, pre-push gating, bypass, no consumer impact)

### Modified Capabilities

None

## Approach

- Add devDependencies: `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`.
- Config: `lint-staged` key in `package.json` (`"*": "prettier --write --ignore-unknown"`); `commitlint.config.js` (ESM, extends conventional). Ensure `.prettierignore`-covered files are skipped.
- Hook files in `.husky/` (plain shell, executable mode `100755` committed in Git).
- Engines decision: keep `engines.node >=22` because it governs the published runtime, not dev tooling. Dev-only Node floor (lint-staged 17 needs >=22.22.1, commitlint 21 needs >=22.12) is expressed via `.nvmrc` and README.
- `files` whitelist already excludes `.husky`; `prepare` does not run on registry/npx installs. Verify with `npm pack --dry-run`.
- Hexagonal layers affected: none (repository tooling only; no domain, port, or adapter code).

## Affected Areas

| Area                   | Impact   | Description                                     |
| ---------------------- | -------- | ----------------------------------------------- |
| `package.json`         | Modified | devDependencies, `prepare`, `lint-staged` block |
| `package-lock.json`    | Modified | New dev dependency tree                         |
| `.husky/`              | New      | `pre-commit`, `commit-msg`, `pre-push`          |
| `commitlint.config.js` | New      | Conventional commits config                     |
| `.nvmrc`               | New      | Contributor Node version                        |
| `README.md`            | Modified | Development section                             |

## Risks

| Risk                                                | Likelihood | Mitigation                                              |
| --------------------------------------------------- | ---------- | ------------------------------------------------------- |
| Contributor on Node 22.0-22.22.0 hits engine errors | Med        | `.nvmrc` + README note                                  |
| `prepare` fails where Husky/devDeps are absent      | Low        | Verify `npm pack`; fallback `husky \|\| true`           |
| Hook files lose executable bit                      | Low        | Commit with mode `100755`; verify via `git ls-files -s` |
| Slow pre-push discourages use                       | Low        | Documented bypass                                       |
| No CI, hooks bypassable                             | Med        | Accepted; CI is a follow-up                             |

## Rollback Plan

Revert the PR, then run `git config --unset core.hooksPath` locally (Husky sets it to `.husky/_`) and `npm install` to prune dev dependencies.

## Dependencies

- `husky@^9`, `lint-staged@^17`, `@commitlint/cli@^21`, `@commitlint/config-conventional@^21`

## Success Criteria

- [ ] Fresh `npm install` installs hooks (`core.hooksPath` set)
- [ ] Committing an unformatted staged file auto-formats it
- [ ] Non-conventional commit message is rejected
- [ ] Push with a type error or failing test is blocked
- [ ] `npm pack --dry-run` contains no `.husky`/config files; `npx @jsisques/dotagent` unaffected
