# Delta for git-hooks

## MODIFIED Requirements

### Requirement: Hook installation on install

The repository MUST install Git hooks automatically via a `prepare` script when contributors run `pnpm install`. The `prepare` script MUST NOT fail installs where dev dependencies are absent.
(Previously: triggered by `npm install`)

#### Scenario: Fresh install sets hooks path

- GIVEN a fresh clone with dev dependencies available
- WHEN `pnpm install` completes
- THEN `git config core.hooksPath` is set to the Husky hooks directory

#### Scenario: Install without dev dependencies

- GIVEN an install where Husky is not present
- WHEN the `prepare` script runs
- THEN the install exits successfully

### Requirement: Pre-push gating

The `pre-push` hook MUST run `pnpm run typecheck`, `pnpm run test:changed` (Vitest limited to tests affected by changes relative to `origin/main`, passing when none are affected), and `pnpm run build`, and MUST block the push if any fails. The `pre-commit` and `commit-msg` hooks MUST invoke tools via `pnpm exec`.
(Previously: `npm run ...`; other hooks used `npx --no --`)

#### Scenario: Type error blocks push

- GIVEN a commit containing a TypeScript type error
- WHEN the contributor runs `git push`
- THEN typecheck fails and the push is aborted

#### Scenario: Failing test blocks push

- GIVEN a commit that makes a test affected by the changes fail
- WHEN the contributor runs `git push`
- THEN the push is aborted

#### Scenario: Unrelated tests skipped

- GIVEN a commit that touches only code covered by a subset of tests
- WHEN the contributor runs `git push`
- THEN only the affected tests run

#### Scenario: No affected tests

- GIVEN a commit that affects no test (for example docs only)
- WHEN the contributor runs `git push`
- THEN the test step passes without running tests

#### Scenario: All checks pass

- GIVEN typecheck, tests, and build all succeed
- WHEN the contributor runs `git push`
- THEN the push proceeds

#### Scenario: Hooks still block bad commits

- GIVEN a non-conventional message or unformatted staged file
- WHEN the contributor commits via the pnpm-based hooks
- THEN the message is rejected or the file is formatted

## Unchanged (decision)

"Consumer safety" keeps `npm pack --dry-run`: it describes what consumers receive, so it stays on npm and is not modified.
