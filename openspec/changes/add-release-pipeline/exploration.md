# Exploration: add-release-pipeline

Issue: JSisques/shitaku#27. Depends on #26 (CI, done) and #28 (rename, done).

## Current State

- `.github/workflows/ci.yml`: triggers on `pull_request` to `main` only; single job `ci` (install, lint, format:check, typecheck, test, build, smoke:pack); `contents: read`.
- `package.json`: `@jsisques/shitaku`, version `0.0.0`, `repository.url` set, `publishConfig: { access: public }`, `prepublishOnly` repeats typecheck/test/build/smoke:pack, pnpm 10.34.6 pinned.
- No `CHANGELOG.md`, `.npmrc` or `.releaserc`. commitlint uses `config-conventional`.

## Verified facts (orchestrator, via `gh`/`npm`)

- `main` is NOT protected and there are no rulesets, so `GITHUB_TOKEN` can push the release commit.
- `@jsisques/shitaku` does NOT exist on npm yet (404).

## Verified requirements (from docs, via explorer)

- npm trusted publishing: npm CLI >= 11.5.1, Node >= 22.14, `id-token: write`, GitHub-hosted runner, workflow filename (with `.yml`) bound exactly on npmjs.com, fields immutable.
- The package must exist before a trusted publisher can be configured, so the first publish is a bootstrap.
- Provenance is automatic for public packages from public repos; `repository.url` must match exactly.
- GitHub Packages does not use npm OIDC: it needs `GITHUB_TOKEN` with `packages: write`; scope `@jsisques` matches the owner.
- semantic-release v25 (v26 beta needs a newer Node); recipe: `fetch-depth: 0`, no setup-node `registry-url`, `contents/issues/pull-requests: write`, `id-token: write`.
- pnpm 10 delegates `publish` to npm; publish through npm.
- Unverified: bundled npm version in Node 22.22.1 (likely < 11.5.1, needs an upgrade step); pnpm 10 + OIDC.

## Approaches

| Tooling          | Verdict                                              |
| ---------------- | ---------------------------------------------------- |
| semantic-release | Recommended: matches the issue's acceptance criteria |
| release-please   | Release-PR gate, but not "publish on merge"          |
| changesets       | Needs a changeset per PR                             |
| hand-rolled      | Reimplements versioning/idempotency                  |

CI to CD: single `release.yml` with job `ci` then job `release` (`needs: ci`) is recommended; `workflow_call` reuse avoids duplication but needs `id-token` on both; `workflow_run` is fragile.

Dual registry: npm via OIDC, then GitHub Packages via `GITHUB_TOKEN` with the registry passed per command; keep `publishConfig` registry-less.

## Open decisions

1. Tooling (recommended: semantic-release).
2. Bootstrap of the first npm publish and first version (1.0.0 vs 0.x).
3. CI/CD wiring (recommended: single workflow with `needs:`).
4. GitHub `environment` as manual gate (yes/no).
5. Keep or drop `prepublishOnly`.
6. npm version handling (pin `npm@11` vs latest).
7. Update issue #27 text (NPM_TOKEN replaced by OIDC).
8. Add `CHANGELOG.md` to prettier/eslint ignores.

## Risks

- Bootstrap deadlock (package must exist before trusted publisher setup).
- Immutable workflow-filename binding: renaming `release.yml` breaks publishing.
- Partial publish across two registries is not retried by semantic-release for the same version.
- Old bundled npm below 11.5.1.
