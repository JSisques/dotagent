# Delta for CI Workflow

## MODIFIED Requirements

### Requirement: Trigger

`ci.yml` MUST run on `pull_request` events targeting `main` and MUST also be callable via `workflow_call`. It MUST NOT use `push` triggers (the `CD` workflow is dispatched manually and reuses `ci.yml`), matrix builds or `paths`/`paths-ignore` filters. It SHOULD cancel superseded runs for the same ref and MUST bound runtime with `timeout-minutes`. It MUST keep exactly one job `ci` and `permissions: contents: read`.
(Previously: only `pull_request`; `workflow_call` not allowed for reuse.)

#### Scenario: PR to main triggers the workflow

- GIVEN a pull request targeting `main`
- WHEN it is opened or updated
- THEN the workflow runs and reports a check

#### Scenario: Reused by CD

- GIVEN `cd.yml` job `ci` uses `./.github/workflows/ci.yml`
- WHEN `CD` is dispatched on `main`
- THEN the single `ci` job runs with `contents: read` only

#### Scenario: Docs-only PR still runs

- GIVEN a PR changing only markdown files
- WHEN it is opened
- THEN the `ci` job still runs and is not skipped

#### Scenario: Superseded run is cancelled

- GIVEN a run is in progress for a PR
- WHEN a new commit is pushed to that PR
- THEN the earlier run is cancelled
