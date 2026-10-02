# Tasks: Add PR CI Workflow

## Review Workload Forecast

| Field                   | Value                                 |
| ----------------------- | ------------------------------------- |
| Estimated changed lines | ~35 (workflow) + ~150 (SDD artifacts) |
| 400-line budget risk    | Low                                   |
| Chained PRs recommended | No                                    |
| Suggested split         | Single PR                             |
| Delivery strategy       | auto-chain                            |
| Chain strategy          | pending                               |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                       | Likely PR | Focused test command                                           | Runtime harness                                    | Rollback boundary                 |
| ---- | -------------------------- | --------- | -------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| 1    | Add `ci` PR validation job | PR 1      | `actionlint .github/workflows/ci.yml && pnpm run format:check` | Six `pnpm run` gates locally; live PR run (manual) | Delete `.github/workflows/ci.yml` |

## Phase 1: Preparation

- [x] 1.1 Verify current majors on each releases page: `actions/checkout`, `actions/setup-node`, `pnpm/action-setup` (design expects v6, v6, v4). If newer, check breaking changes; keep explicit `cache: pnpm`.

## Phase 2: Implementation

- [x] 2.1 Create `.github/workflows/ci.yml` exactly per design (trigger `pull_request` on `main`, `contents: read`, concurrency cancel, single job `ci`, `timeout-minutes: 15`, pnpm before node, six gates in order), using verified majors from 1.1.
- [x] 2.2 Run `pnpm exec prettier --write openspec/changes/add-ci-workflow .github/workflows/ci.yml`.

## Phase 3: Verification (mapped to spec scenarios)

- [x] 3.1 Run `actionlint .github/workflows/ci.yml` (`brew install actionlint` if missing). Covers Trigger, Stable job name, Toolchain resolution.
- [x] 3.2 Inspect the file: only `contents: read`, no `paths`, `push`, matrix, job `if` or `continue-on-error`. Covers Least-privilege, Docs-only PR, Failure semantics.
- [x] 3.3 Run `pnpm run format:check`; expect exit 0. Covers Workflow file formatting.
- [x] 3.4 Run locally in order: `pnpm install --frozen-lockfile`, then `pnpm run lint`, `format:check`, `typecheck`, `test`, `build`, `smoke:pack`. Covers Clean PR passes, Smoke pack follows build, Lockfile drift.
- [x] 3.5 Confirm step order in the file matches 3.4 and `pnpm/action-setup` precedes `actions/setup-node`.

## Phase 4: Commit

- [x] 4.1 Commit: `ci: add pull request validation workflow` (conventional commit, no AI attribution). Commit SDD artifacts as `docs: add add-ci-workflow SDD artifacts`.

## Manual post-merge steps (out of scope for apply)

- [ ] M.1 Open the first PR; confirm one check named `ci`, all steps green, token `contents: read`. Covers PR triggers, Superseded run, Single stable check.
- [ ] M.2 Optionally add `ci` as a required check in branch protection after the first green run.
