# Design: Add PR CI Workflow

## Technical Approach

Add one GitHub Actions workflow, `.github/workflows/ci.yml`, with a single job `ci` that runs on `pull_request` to `main`. It resolves the toolchain from the repository (pnpm from `packageManager`, Node from `.nvmrc`) and then runs the existing `package.json` gate scripts in order. No hexagonal layers are affected: `src/` is untouched, so the domain/ports boundary rule does not apply.

## Architecture Decisions

| Decision       | Choice                                                    | Rejected                      | Rationale                                                                          |
| -------------- | --------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| Job topology   | One job, id and `name` both `ci`                          | Parallel jobs / matrix        | One stable required-check name, one install, lowest cost                           |
| Trigger        | `pull_request` on `main`                                  | `pull_request_target`, `push` | Untrusted fork code never gets a write token; `push` is out of scope               |
| Filters        | None                                                      | `paths`, job-level `if`       | A skipped required check stays Pending forever                                     |
| pnpm setup     | `pnpm/action-setup` without `version`                     | Corepack, pinned `version`    | Reads `packageManager`; passing both inputs errors                                 |
| Node setup     | `actions/setup-node` with `node-version-file: .nvmrc`     | Literal `22`                  | Single source of truth, matches local dev                                          |
| Caching        | `cache: pnpm` on `setup-node`                             | `actions/cache` by hand       | Built-in store cache keyed on `pnpm-lock.yaml`; needs pnpm on PATH first           |
| Action pinning | Major tags (`@vN`)                                        | Full commit SHAs              | Readable, auto-patched; token is read-only, no secrets; SHA pinning is a follow-up |
| Concurrency    | Group per workflow and PR ref, `cancel-in-progress: true` | No concurrency                | Superseded pushes stop burning minutes                                             |
| Timeout        | `timeout-minutes: 15`                                     | Default 360                   | Bounds a hung `smoke:pack` network call; normal run is a few minutes               |
| Permissions    | Workflow-level `contents: read`                           | Default token scopes          | Least privilege                                                                    |

### Action versions (verify at apply)

Context7 was not available in this phase, so the versions below are the expected current majors and MUST be confirmed against each action's releases page at apply time: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`. If a newer major exists, check its breaking changes (for example, `setup-node` v5+ automatic caching applies only to npm, so the explicit `cache: pnpm` is still required).

## Data Flow

    PR opened/synchronized -> checkout -> pnpm (packageManager) -> node (.nvmrc) + pnpm store cache
      -> install --frozen-lockfile -> lint -> format:check -> typecheck -> test -> build -> smoke:pack

Step order rationale: `pnpm/action-setup` precedes `setup-node` so `cache: pnpm` can locate the store. Cheap static checks run first to fail fast. `build` precedes `smoke:pack` because `smoke:pack` exits 1 without `dist/main.js`. `smoke:pack` is last because it is the slowest and the only network-dependent step.

## Interfaces / Contracts

```yaml
name: CI

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run format:check
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run build
      - run: pnpm run smoke:pack
```

Contract: the job name `ci` is the branch-protection check name and MUST NOT be renamed. Prettier compatibility: two-space indentation, no quotes needed; if a value ever needs quoting, use single quotes (`.prettierrc` sets `singleQuote`).

## File Changes

| File                       | Action | Description            |
| -------------------------- | ------ | ---------------------- |
| `.github/workflows/ci.yml` | Create | PR validation workflow |

## Testing Strategy

| Layer    | What to Test                    | Approach                                                                          |
| -------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Static   | Workflow syntax and expressions | `actionlint .github/workflows/ci.yml` (install via `brew install actionlint`)     |
| Format   | YAML style                      | `pnpm run format:check` with the file present                                     |
| Local    | Each gate passes on the branch  | Run the six `pnpm run` steps locally in the same order                            |
| Live     | Trigger, check name, step order | First PR run: confirm a check named `ci`, all steps green, token `contents: read` |
| Negative | A failing gate fails the job    | Optional throwaway commit with a lint error, observe red, then drop it            |

No vitest test is added: the artifact is declarative YAML with no runtime code in `src/`. Strict TDD is satisfied by the static checks above plus the live PR run.

## Threat Matrix

N/A — the change adds CI configuration only; it introduces no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in the product. CI security is handled by the `pull_request` trigger and read-only token.

## Migration / Rollout

No migration required. After the first green run, the maintainer may add `ci` as a required check in branch protection (manual, out of scope). Rollback: remove the required check first if set, then revert the commit or delete `.github/workflows/ci.yml`.

## Open Questions

- [ ] Confirm current action majors at apply time (non-blocking).
