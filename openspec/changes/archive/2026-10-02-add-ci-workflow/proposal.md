# Proposal: Add PR CI Workflow

## Intent

No automated checks run on pull requests (`.github/` does not exist). Quality gates exist only in local husky hooks, which can be skipped. Issue #26 asks for one PR workflow that runs lint, format, typecheck, test and build. Now that ESLint has landed (#29), every gate script exists.

## Scope

### In Scope

- `.github/workflows/ci.yml` with a single job named `ci`, triggered by `pull_request` on `main`
- `permissions: contents: read`
- Steps: checkout, `pnpm/action-setup` (no `version`), `actions/setup-node` (`node-version-file: .nvmrc`, `cache: pnpm`), `pnpm install --frozen-lockfile`, then lint, format:check, typecheck, test, build, smoke:pack
- `concurrency` with cancel-in-progress and `timeout-minutes`
- Workflow file passes `prettier --check .`

### Out of Scope

- Publishing and versioning (#27)
- Branch protection and required-check setup (manual GitHub step)
- `push` triggers, matrix builds, and `paths` filters
- README `>=22.22.1` vs `engines` mismatch

## Capabilities

### New Capabilities

- `ci-workflow`: PR validation workflow covering trigger, permissions, toolchain resolution, ordered gate steps, and the stable `ci` check name.

### Modified Capabilities

- None

## Approach

Use the single-job approach from the exploration. One job gives one stable required-check name and the lowest cost. The toolchain comes from the repository: pnpm from `packageManager` and Node from `.nvmrc`. `pnpm/action-setup` must run before `setup-node` so that `cache: pnpm` works. `smoke:pack` runs last because it needs `dist/`. Action versions are verified at apply time.

**Hexagonal layers affected**: none. This is repository infrastructure only, and `src/` is untouched.

## Affected Areas

| Area                       | Impact | Description |
| -------------------------- | ------ | ----------- |
| `.github/workflows/ci.yml` | New    | PR workflow |

## Risks

| Risk                                       | Likelihood | Mitigation                                         |
| ------------------------------------------ | ---------- | -------------------------------------------------- |
| `smoke:pack` network flake                 | Med        | Re-run the job; keep timeout bounded               |
| Renaming the job breaks the required check | Low        | Spec pins the job name `ci`                        |
| Stale or incorrect action versions         | Low        | Verify major versions at apply time                |
| YAML fails `format:check`                  | Low        | Run `pnpm run format:check` locally before pushing |

## Rollback Plan

Revert the commit or delete `.github/workflows/ci.yml`. If branch protection already requires `ci`, remove that required check in the GitHub settings first. Nothing else depends on the file.

## Dependencies

- #29 ESLint (merged)
- GitHub Actions enabled on the repository

## Success Criteria

- [ ] A PR to `main` triggers a check named `ci`
- [ ] All seven steps run in order and pass on a clean PR
- [ ] A failing lint, format, typecheck, test or build fails the job
- [ ] `pnpm run format:check` passes with the workflow file present
- [ ] The workflow token has only `contents: read`
