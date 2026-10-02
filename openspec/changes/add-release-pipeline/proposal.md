# Proposal: Add Release Pipeline

Issue: JSisques/shitaku#27

## Intent

Releases are manual and the package has never been published. Running the CD workflow on `main` must version, changelog and publish `@jsisques/shitaku` to npm and GitHub Packages automatically, with least privilege and no long-lived tokens.

## Scope

### In Scope

- `.github/workflows/cd.yml` (name `CD`, `workflow_dispatch` only, boolean input `dry_run` default false): job `ci` reuses `ci.yml`, job `release` (`needs: ci`, runs only when `github.ref == 'refs/heads/main'`) runs semantic-release v25; with `dry_run` true it runs `semantic-release --dry-run` (publishes nothing). Merging to `main` publishes nothing by itself.
- `ci.yml` gains `workflow_call`; keeps `pull_request`.
- semantic-release config: commit analyzer, release notes, changelog, npm, GitHub Packages publish, git (assets `CHANGELOG.md`, `package.json`; message `chore(release): X [skip ci]`), GitHub Release.
- npm via Trusted Publishers (OIDC); explicit `npm@11` upgrade step.
- GitHub Packages via `GITHUB_TOKEN`, registry passed per command.
- `CHANGELOG.md` added to Prettier and ESLint ignores.
- Bootstrap documentation (manual `0.1.0` publish, tag `v0.1.0`, trusted publisher registration).
- Update issue #27 text (NPM_TOKEN replaced by OIDC, bootstrap prerequisite, manual-dispatch trigger and reworded acceptance criteria).

### Out of Scope

- release-please, changesets, prerelease channels.
- GitHub `environment` gates, PAT or GitHub App tokens.

## Capabilities

### New Capabilities

- `release-pipeline`: CD workflow, permissions, versioning, changelog, dual-registry publish, bootstrap prerequisite.

### Modified Capabilities

- `ci-workflow`: trigger adds `workflow_call` alongside `pull_request`.
- `lint-tooling`: ESLint ignores add `CHANGELOG.md`.

## Approach

- `ci` job: `uses: ./.github/workflows/ci.yml`, `contents: read`.
- `release` job: `contents`, `issues`, `pull-requests`, `packages` write plus `id-token: write`; concurrency group without `cancel-in-progress`; `fetch-depth: 0`; no setup-node `registry-url`; publish through npm, not pnpm.
- `prepublishOnly` kept; `publishConfig` stays registry-less.
- Design must verify semantic-release continues from tag `v0.1.0` with default commit-analyzer rules (standard semver after the `0.1.0` bootstrap).

## Affected Hexagonal Layers

None. CI/config only; `src/` untouched.

## Affected Areas

| Area                                  | Impact          | Description                                 |
| ------------------------------------- | --------------- | ------------------------------------------- |
| `.github/workflows/cd.yml`            | New             | CD workflow                                 |
| `.github/workflows/ci.yml`            | Modified        | `workflow_call` trigger                     |
| `.releaserc*` / `package.json`        | New/Modified    | semantic-release config and devDependencies |
| `.prettierignore`, `eslint.config.js` | Modified        | Ignore `CHANGELOG.md`                       |
| `CHANGELOG.md`                        | New (generated) | Release notes                               |

## Risks

| Risk                                                 | Likelihood | Mitigation                                                                                   |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Workflow filename bound immutably on npmjs.com       | Med        | Never rename `cd.yml`; documented                                                            |
| Partial publish across registries                    | Med        | npm first; manual GitHub Packages republish documented                                       |
| Bundled npm < 11.5.1                                 | High       | Explicit `npm@11` step                                                                       |
| semantic-release jumps to 1.0.0                      | Med        | Tag `v0.1.0` must be reachable from `main`; otherwise no reachable tag falls back to `1.0.0` |
| `ci.yml` concurrency conflicts under `workflow_call` | Low        | Design reviews group keys                                                                    |
| Manual dispatch from a non-main branch               | Low        | Job-level `if: github.ref == 'refs/heads/main'` guard on `release`                           |
| `dry_run` mutating state                             | Low        | `semantic-release --dry-run`; exec publish skipped; no commit, tag or Release                |

## Rollback Plan

- Revert the PR (removes `cd.yml`, `workflow_call`, config); `ci.yml` PR checks are unaffected.
- Bad release: `npm deprecate` the version (unpublish only within 72h), delete the GitHub Release and tag, revert the release commit.
- Revoke the trusted publisher on npmjs.com to halt publishing.

## Dependencies

- #26 (CI) and #28 (rename) done.
- Manual bootstrap: publish `0.1.0`, tag `v0.1.0`, register trusted publisher (repo `JSisques/shitaku`, workflow `cd.yml`).

## Success Criteria

- [ ] Running the CD workflow on `main` publishes the accumulated `feat`/`fix` commits since the last tag to both registries and updates `CHANGELOG.md`; `chore`/`docs`-only history publishes nothing; least-privilege permissions.
- [ ] A `dry_run` dispatch reports the next version and publishes nothing; merging to `main` publishes nothing by itself.
- [ ] Only the `release` job holds write permissions; no `NPM_TOKEN` exists.
- [ ] npm releases carry provenance.
