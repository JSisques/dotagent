# Releasing

Releases are manual. Merging to `main` publishes nothing. A maintainer dispatches the `CD` workflow (`.github/workflows/cd.yml`), which runs CI and then semantic-release. semantic-release derives the version from Conventional Commits since the last tag, updates `CHANGELOG.md` and `package.json`, creates the tag and a GitHub Release, and publishes `@jsisques/shitaku` to npm (OIDC, with provenance) and then to GitHub Packages (`GITHUB_TOKEN`).

## Versioning

- The first version is `0.1.0`, published by hand (see Bootstrap).
- After that, default semver applies: `fix` and `perf` bump the patch, `feat` bumps the minor, and a breaking change (`!` in the header or a `BREAKING CHANGE:` footer) bumps the major. From `0.1.0`, the first breaking change releases `1.0.0`.
- `chore`, `docs` and other non-releasing types publish nothing.
- `CHANGELOG.md` is generated and listed in `.prettierignore`. Do not edit it by hand.

## Bootstrap (one-time prerequisite)

semantic-release needs a previous release tag, and npm OIDC needs the package to exist. Do this once, before the first `CD` run:

1. Open a PR `chore(release): 0.1.0` that only sets `version` to `0.1.0` in `package.json`, and merge it.
2. On that `main` commit run `pnpm install --frozen-lockfile`, `npm login`, then `npm publish` (needs 2FA).
3. Tag that exact commit and push the tag: `git tag v0.1.0 <sha>` then `git push origin v0.1.0`. The tag MUST be reachable from `main`; otherwise semantic-release finds no tag and computes `1.0.0` from the full history.
4. On npmjs.com, open the package settings and add a Trusted Publisher: provider GitHub Actions, owner `JSisques`, repository `shitaku` (`JSisques/shitaku`), workflow filename `cd.yml`, environment empty.

Never rename `cd.yml`: the trusted publisher is bound to that filename, and the publish runs inside it. Renaming it breaks npm publishing until the trusted publisher is updated.

## Dry run

Run the `CD` workflow on `main` with `dry_run` checked (Actions tab, `CD`, Run workflow). It runs CI, then `semantic-release --dry-run`, which logs the OIDC token exchange and the next version (or "no relevant changes"). It creates no commit, tag or GitHub Release and publishes to no registry. Do this after any change to the release setup.

## Releasing

Dispatch `CD` on `main` with `dry_run` unchecked. Dispatching from another branch runs CI only; the `release` job is skipped.

Overlapping dispatches are serialized by a `release-<ref>` concurrency group and never cancel a running release. A dry run shares the group, so it queues behind a real release. GitHub keeps only one pending run per group, so two quick dispatches can replace a pending (queued) run. The `ci` job uses its own `ci-<ref>` group with `cancel-in-progress: false` for non-pull-request runs; two quick dispatches can likewise replace a pending `ci` run. Wait for the first run to start before dispatching again.

## Failure recovery

Order inside the release: release commit and tag are pushed first, then npm, then GitHub Packages, then the GitHub Release.

- **npm publish fails**: the tag and release commit are already on `main`. Nothing reached GitHub Packages or GitHub Releases. Delete the remote tag (`git push origin :refs/tags/vX.Y.Z`), revert the `chore(release)` commit, and dispatch `CD` again, or publish manually with `npm publish` from the tag.
- **GitHub Packages publish fails**: npm already has the version and there is no GitHub Release. From the tag, run `npm publish --registry https://npm.pkg.github.com` with a token that can write packages, then `gh release create vX.Y.Z --generate-notes`.
- **`OIDC token exchange` fails**: check the trusted publisher fields above and that npm is 11.5.1 or later in the job log.
- **Release is skipped as "behind remote"**: `main` moved after the run started. Dispatch `CD` again.

## Maintenance

Keep `conventional-changelog-conventionalcommits` on `9.x`. Version `10.x` requires `conventional-changelog-writer@9`, but `@semantic-release/release-notes-generator@14` ships writer 8, so release notes fail to render ("Missing helper"). Upgrade the preset only together with a release-notes-generator that uses writer 9. After any dependency change to the release tooling, run a `dry_run` dispatch.
