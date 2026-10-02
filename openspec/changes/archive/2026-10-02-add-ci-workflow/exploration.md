# Exploration: add-ci-workflow

Source: GitHub issue #26 — ci: add PR workflow (lint, format, typecheck, test, build). Depends on #29 (lint). Out of scope: publishing/versioning (#27).

## Current State

- `package.json` has `lint`, `format:check`, `typecheck`, `test`, `build` and `smoke:pack` scripts with exact names. Install is the seventh step and is not a script.
- `.github/` does not exist: no workflows, templates or dependabot config.
- `packageManager` is `pnpm@10.34.6+sha512...`; `pnpm-lock.yaml` exists; no `.npmrc` or `pnpm-workspace.yaml`.
- `engines.node` is `>=22.13`; `.nvmrc` is `22.22.1`. The README says `>=22.22.1` (minor mismatch, out of scope).
- `prepare` is `husky || true`, so `pnpm install --frozen-lockfile` is safe in CI.
- `smoke:pack` does not build. It exits 1 if `dist/main.js` is missing, so it must run after `build`. It uses `npm pack` and `npm install` from the registry, so it needs network and may flake.
- `build` already runs `scripts/check-dist-aliases.mjs`.

## Recommended Approach

Single job, `permissions: contents: read`, `on: pull_request: branches: [main]` (never `pull_request_target`).

Steps in order:

1. `actions/checkout`
2. `pnpm/action-setup` without a `version` input (reads `packageManager`; passing both errors)
3. `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm` (must come after `pnpm/action-setup`)
4. `pnpm install --frozen-lockfile`
5. `pnpm run` for lint, format:check, typecheck, test, build, smoke:pack

Optional: `concurrency` with cancel-in-progress, and `timeout-minutes`.

## Forks

| Fork                            | Choice              | Reason                                            |
| ------------------------------- | ------------------- | ------------------------------------------------- |
| One job vs parallel matrix      | One job             | One required-check name, lower cost               |
| `.nvmrc` vs literal `22`        | `.nvmrc`            | Single source of truth, still satisfies "Node 22" |
| `pnpm/action-setup` vs corepack | `pnpm/action-setup` | Corepack also works                               |

## Gotchas

- The required-check name in branch protection is the job name (job id if no `name`), not the workflow name. Use a stable name such as `ci` and never rename it. It appears in the branch-protection picker only after its first run.
- Do not use `paths` filters or job-level `if` skips on a required check: a skipped run leaves it Pending forever.
- `ci.yml` must pass `prettier --check .`, since `format:check` covers `.github` YAML.
- Branch protection is a manual GitHub step outside the repo.

## Risks

- Action major versions or SHAs must be verified at apply time.
- Network flake in `smoke:pack`.
- Engram auto-detects the project as `dotagent` (legacy name); explore saved as id 1081, topic key `sdd/add-ci-workflow/explore`.

## Next Recommended

`sdd-propose`: new `ci-workflow` capability using the single-job approach.
