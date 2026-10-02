# git-hooks Specification

## Purpose

Contributor-side Git hooks that enforce formatting, commit-message convention, and pre-push quality gates locally. No impact on package consumers.

## Requirements

### Requirement: Hook installation on install

The repository MUST install Git hooks automatically via a `prepare` script when contributors run `npm install`. The `prepare` script MUST NOT fail installs where dev dependencies are absent.

#### Scenario: Fresh install sets hooks path

- GIVEN a fresh clone with dev dependencies available
- WHEN `npm install` completes
- THEN `git config core.hooksPath` is set to the Husky hooks directory

#### Scenario: Install without dev dependencies

- GIVEN an install where Husky is not present
- WHEN the `prepare` script runs
- THEN the install exits successfully

### Requirement: Pre-commit formatting

The `pre-commit` hook MUST run Prettier via lint-staged on staged files only, MUST re-stage the formatted result, and MUST skip files covered by `.prettierignore` and unknown file types.

#### Scenario: Unformatted staged file

- GIVEN a staged file that violates Prettier formatting
- WHEN the contributor runs `git commit`
- THEN the file is formatted and the formatted content is committed

#### Scenario: Ignored or unknown file

- GIVEN a staged file ignored by `.prettierignore` or of an unknown type
- WHEN the contributor runs `git commit`
- THEN the file is left unchanged and the commit proceeds

### Requirement: Commit message validation

The `commit-msg` hook MUST validate messages with commitlint using `@commitlint/config-conventional` and MUST reject non-conforming messages.

#### Scenario: Non-conventional message rejected

- GIVEN staged changes
- WHEN the contributor commits with message `update stuff`
- THEN the commit is rejected with a commitlint error

#### Scenario: Conventional message accepted

- GIVEN staged changes
- WHEN the contributor commits with message `feat: add hooks`
- THEN the commit succeeds

### Requirement: Pre-push gating

The `pre-push` hook MUST run `npm run typecheck`, `npm run test:changed` (Vitest limited to tests affected by changes relative to `origin/main`, passing when none are affected), and `npm run build`, and MUST block the push if any fails.

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

### Requirement: Hook bypass

Contributors MUST be able to bypass hooks via `--no-verify` or `HUSKY=0`.

#### Scenario: Bypass with HUSKY=0

- GIVEN a non-conventional commit message
- WHEN the contributor commits with `HUSKY=0`
- THEN the commit succeeds without running hooks

### Requirement: Executable hook files

Hook files `pre-commit`, `commit-msg`, and `pre-push` MUST be committed with Git mode `100755`.

#### Scenario: Modes verified

- GIVEN the committed repository
- WHEN `git ls-files -s .husky` is run
- THEN every hook file shows mode `100755`

### Requirement: Contributor Node version

The repository MUST provide `.nvmrc` pinning Node 22.22.1 or later, and `engines.node` MUST remain `>=22`.

#### Scenario: Version pinned

- GIVEN the repository root
- WHEN `.nvmrc` is read
- THEN it specifies a Node version of 22.22.1 or later

### Requirement: README Development documentation

`README.md` MUST include a "Development" section covering hooks, the Node requirement, and bypass methods (`--no-verify`, `HUSKY=0`).

#### Scenario: Documentation present

- GIVEN `README.md`
- WHEN its Development section is read
- THEN it documents hooks, the Node requirement, and both bypass methods

### Requirement: Consumer safety

Hook tooling and configuration (`.husky`, `commitlint.config.js`, `.nvmrc`) MUST NOT appear in the published package, and consumer installs MUST NOT run `prepare`.

#### Scenario: Package contents

- GIVEN the repository with hooks added
- WHEN `npm pack --dry-run` is run
- THEN no `.husky`, commitlint, or `.nvmrc` file is listed
- AND `npx @jsisques/dotagent` behavior is unchanged
