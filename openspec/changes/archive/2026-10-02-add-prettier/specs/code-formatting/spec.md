# Code Formatting Verification Criteria

## Purpose

Tooling-only change: no runtime or product behavior is added, modified, or removed (proposal Capabilities: none).
This artifact states that explicitly and records the testable acceptance criteria for the repository formatting
tooling. Nothing here is promoted to `openspec/specs/` as product behavior.

## Requirements

### Requirement: Deterministic format check

The repository MUST provide `format` (`prettier --write .`) and `format:check` (`prettier --check .`) npm scripts
using the config `printWidth: 120`, `singleQuote: true`, `semi: true`, `trailingComma: "all"`.

#### Scenario: Codebase is formatted

- GIVEN the formatting pass has been applied
- WHEN `npm run format:check` is run
- THEN it exits 0

#### Scenario: Unformatted file is detected

- GIVEN a tracked source file violates the Prettier config
- WHEN `npm run format:check` is run
- THEN it exits non-zero and names the file

### Requirement: Ignore list

`.prettierignore` MUST exclude `dist`, `node_modules`, `package-lock.json`, `coverage`, `.atl/`, and
`openspec/changes/archive/`.

#### Scenario: Ignored paths are skipped

- GIVEN unformatted content exists under an ignored path
- WHEN `npm run format:check` is run
- THEN that content does not cause a failure

### Requirement: No behavior regression

Formatting MUST NOT change runtime behavior.

#### Scenario: Existing quality gates pass

- GIVEN the formatting pass has been applied
- WHEN `npm run typecheck`, `npm run build`, and `npm test` are run
- THEN all three exit 0

### Requirement: Published artifact unchanged

The `files` field of `package.json` MUST remain unchanged.

#### Scenario: Files field untouched

- GIVEN the change branch compared against `main`
- WHEN the `files` value in `package.json` is diffed
- THEN there is no difference

### Requirement: Isolated formatting commit

The one-time formatting pass MUST be a separate commit, `style: format codebase with prettier`, containing only
the output of `npm run format` with no manual edits.

#### Scenario: Style commit is pure

- GIVEN the style commit is checked out
- WHEN `npm run format` is run
- THEN the working tree has no changes

#### Scenario: Config precedes formatting

- GIVEN the branch history
- WHEN commits are listed in order
- THEN `chore: add prettier` precedes `style: format codebase with prettier`

### Requirement: Documentation and project config

The README Development section MUST document `format` and `format:check`, and `openspec/config.yaml` MUST set
`testing.formatter` to `prettier`.

#### Scenario: Docs and config updated

- GIVEN the chore commit
- WHEN README.md and openspec/config.yaml are read
- THEN both commands are documented and `testing.formatter` equals `prettier`

### Requirement: Diff budget

The formatting diff SHOULD stay under 400 changed lines, excluding `package-lock.json`. If exceeded, work MUST
stop for a decision.

#### Scenario: Budget measured

- GIVEN the formatting pass is applied
- WHEN `git diff --stat` is reviewed
- THEN the total (excluding the lockfile) is under 400 lines, or work stops and asks
