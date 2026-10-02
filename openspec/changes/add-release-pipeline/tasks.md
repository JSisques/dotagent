# Tasks: Add Release Pipeline

## Review Workload Forecast

| Field                   | Value                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Estimated changed lines | ~300 authored + ~500 OpenSpec artifacts (excl. generated `pnpm-lock.yaml`, ~1000+ lines) |
| 400-line budget risk    | High                                                                                     |
| Chained PRs recommended | Yes                                                                                      |
| Suggested split         | PR 1 (slice 1) -> PR 2 (slice 2)                                                         |
| Delivery strategy       | ask-on-risk                                                                              |
| Chain strategy          | pending                                                                                  |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The lockfile is generated and excluded from the count. Code alone (~300) is Medium; with OpenSpec artifacts it exceeds 400.

### Suggested Work Units

| Unit | Goal                                                   | Likely PR | Focused test command                          | Runtime harness                                  | Rollback boundary                             |
| ---- | ------------------------------------------------------ | --------- | --------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 1    | `ci.yml` workflow_call + CHANGELOG ignores (~60 lines) | PR 1      | `pnpm vitest run test/release-config.test.ts` | `actionlint .github/workflows/ci.yml`            | `ci.yml`, ignores, their tests                |
| 2    | semantic-release config, `cd.yml`, docs (~240 lines)   | PR 2      | `pnpm vitest run test/release-config.test.ts` | scratch-clone `semantic-release --dry-run` (4.3) | cd.yml, .releaserc.json, npmrc, devDeps, docs |

## Phase 1: Slice 1 - CI reuse and ignores (RED then GREEN)

- [x] 1.1 RED: create `test/release-config.test.ts`; assert `ci.yml` has `workflow_call`, `group: ci-`, no `push:`, one `ci` job (spec: Reused by CD, Superseded run)
- [x] 1.2 RED: assert `CHANGELOG.md` ignored by Prettier `getFileInfo` and ESLint `isPathIgnored` (spec: Changelog ignored)
- [x] 1.3 GREEN: edit `.github/workflows/ci.yml` (`workflow_call`, concurrency per design)
- [x] 1.4 GREEN: add `CHANGELOG.md` to `.prettierignore` and `eslint.config.js` ignores

## Phase 2: Slice 2 - RED contract tests

- [x] 2.1 RED: `cd.yml` text: `workflow_dispatch`, `dry_run`, `refs/heads/main`, `needs: ci`, `npm@11`, `HUSKY`, `fetch-depth: 0`, `persist-credentials: false`, `cancel-in-progress: false`, `id-token: write` once, no `push:`, no `NPM_TOKEN`, no `registry-url`
- [x] 2.2 RED: `.releaserc.json` plugin order (npm < exec < github; changelog, npm < git), `[skip ci]` message, assets `CHANGELOG.md`+`package.json`, no `releaseRules`
- [x] 2.3 RED: `package.json` has no `publishConfig.registry`; `.github/github-packages.npmrc` exists with `${GITHUB_TOKEN}`
- [x] 2.4 RED: `docs/releasing.md` mentions `0.1.0`, `v0.1.0`, trusted publisher, `cd.yml` rename warning; `README.md` links it

## Phase 3: Slice 2 - Implementation

- [x] 3.1 `pnpm add -D semantic-release@^25 @semantic-release/changelog @semantic-release/git @semantic-release/exec conventional-changelog-conventionalcommits`
- [x] 3.2 Create `.releaserc.json` per design
- [x] 3.3 Create `.github/github-packages.npmrc`
- [x] 3.4 Create `.github/workflows/cd.yml` per design
- [x] 3.5 Create `docs/releasing.md` (bootstrap runbook, failure recovery, dry-run); add "Releasing" pointer to `README.md`

## Phase 4: Validation (automatable)

- [x] 4.1 `actionlint` on `ci.yml` and `cd.yml`
- [x] 4.2 `pnpm run lint`, `format:check`, `typecheck`, `test`, `build` all exit 0
- [x] 4.3 Scratch clone, tag `v0.1.0`: `feat` -> 0.2.0, `fix` -> 0.1.1, `feat!:` and `BREAKING CHANGE:` footer -> 1.0.0 (config limited to commit-analyzer + notes, same preset)

## Phase 5: Manual maintainer tasks (NOT automatable, not for sdd-apply)

- [ ] 5.1 Bootstrap PR `chore(release): 0.1.0` (version only); merge
- [ ] 5.2 On that `main` commit: `npm publish` manually (2FA)
- [ ] 5.3 `git tag v0.1.0 <sha>` and push the tag
- [ ] 5.4 Register npm trusted publisher: `JSisques/shitaku`, workflow `cd.yml`, no environment
- [ ] 5.5 Merge this change as `ci: ...`; update issue #27 (OIDC, bootstrap, manual dispatch, reworded criteria)
- [ ] 5.6 Dispatch `CD` on `main` with `dry_run` true: expect OIDC success, no commit/tag/Release/publish
