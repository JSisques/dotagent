# Design: Add Release Pipeline

## Technical Approach

New `cd.yml` (manual `workflow_dispatch` only, input `dry_run`; merging to `main` publishes nothing) calls `ci.yml` through `workflow_call`, then a `release` job runs semantic-release v25. npm publishes through OIDC via `@semantic-release/npm`; GitHub Packages publishes through `@semantic-release/exec` with a per-command userconfig. No `src/` change; no hexagonal layer affected.

Verification sources: installed sources of semantic-release 25.0.8, `@semantic-release/npm` 13.1.5, `@semantic-release/git` 11.0.1 and husky 9.1.7 (read locally). Web docs were not reachable in this session; see Unverified.

## Architecture Decisions

| Topic                   | Option                                                                                                  | Tradeoff                                                                                                                                                                                             | Decision                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GitHub Packages publish | `@semantic-release/exec` `publishCmd`                                                                   | One transaction; GitHub Release only created if both registries succeed; extra devDep                                                                                                                | **Chosen**                                                                    |
|                         | Second `@semantic-release/npm` instance                                                                 | Module-level `verified`/`prepared` state and registry resolution (`publishConfig` > `NPM_CONFIG_REGISTRY` > `.npmrc`) are shared: cannot target two registries                                       | Rejected                                                                      |
|                         | Workflow step after semantic-release                                                                    | Runs after GitHub Release; a job re-run cannot recover (re-run sha is behind remote)                                                                                                                 | Rejected                                                                      |
| GH Packages auth        | Committed `.github/github-packages.npmrc` with `${GITHUB_TOKEN}` placeholder, passed via `--userconfig` | No secret in argv; exec commands are lodash templates, so `${...}` must not appear in the command                                                                                                    | **Chosen**                                                                    |
|                         | Global `NPM_CONFIG_USERCONFIG`                                                                          | Redirects the npm plugin's registry lookup away from npmjs                                                                                                                                           | Rejected                                                                      |
| npm binary              | `npm install -g npm@11` step                                                                            | Plugin runs `npm` with `preferLocal`; under pnpm the plugin's bundled `npm` is not linked into root `.bin`, so PATH npm is used                                                                      | **Chosen**                                                                    |
| Commit preset           | `conventionalcommits`                                                                                   | Matches commitlint `config-conventional`, parses `feat!:`; needs devDep                                                                                                                              | **Chosen**                                                                    |
| CD trigger              | `workflow_dispatch` with boolean `dry_run` (default false)                                              | Publishing is an explicit human action; merge never releases; `dry_run` allows safe validation                                                                                                       | **Chosen**                                                                    |
|                         | `push` to `main`                                                                                        | Every merge of releasable commits publishes immediately; no way to validate first                                                                                                                    | Rejected                                                                      |
| Branch guard            | Job-level `if: github.ref == 'refs/heads/main'` on `release`                                            | `workflow_dispatch` can be run from any branch; guard prevents a release from a non-main ref (the `ci` job still runs there)                                                                         | **Chosen**                                                                    |
| Dry-run mode            | `semantic-release --dry-run` when `inputs.dry_run`                                                      | Reports next version, no commit/tag/Release/publish; exec GH Packages publish is also skipped (plugin `publish` step does not run in dry-run)                                                        | **Chosen**                                                                    |
| Concurrency             | Job-level on `release`, literal `ci-` prefix in `ci.yml`                                                | Avoids caller/callee group collision (`github.*` resolves to the caller)                                                                                                                             | **Chosen**                                                                    |
| Git hooks in CI         | `HUSKY: '0'` on `release`                                                                               | `@semantic-release/git` runs `git commit -F -` and `git push` without `--no-verify`; commitlint `body-max-line-length` would reject release notes                                                    | **Chosen** (husky skips install and hooks when `HUSKY=0`, verified in source) |
| Release rules           | commit-analyzer defaults (no custom `releaseRules`)                                                     | Standard semver after the `0.1.0` bootstrap: breaking -> `major`, `feat` -> `minor`, `fix`/`perf` -> `patch` (verified in `@semantic-release/commit-analyzer` 13.0.1 `lib/default-release-rules.js`) | **Chosen**                                                                    |
| Bootstrap               | Separate `chore(release): 0.1.0` PR, manual publish, tag on that `main` commit                          | Repo `package.json` matches tag                                                                                                                                                                      | **Chosen** over tagging with `0.0.0` in tree                                  |

## Verified Behaviour

- Last release = highest semver tag from `git tag --merged main` matching `v${version}` (`get-tags.js`, `get-last-release.js`). Tag `v0.1.0` MUST be on a commit reachable from `main`; otherwise no tag is found and `FIRST_RELEASE = "1.0.0"` is used against the full history.
- Next version = `semver.inc(last, type)`: `fix` → `0.1.1`, `feat` → `0.2.0`, breaking → `1.0.0` (standard semver; breaking changes bump the major, including from 0.x).
- Default rules (`@semantic-release/commit-analyzer` 13.0.1, read locally): `lib/default-release-rules.js` holds `breaking -> major`, `feat -> minor`, `fix -> patch`, `perf -> patch`. No custom `releaseRules` are configured, so these defaults apply.
- Breaking detection: the parser records a `BREAKING CHANGE` note from a `BREAKING CHANGE:` footer or, via the preset's `breakingHeaderPattern`, from `!` in the header (`conventional-commits-parser` 6.4.0 `CommitParser.js:229-241`). The `conventionalcommits` preset itself is not installed locally, so its `!` pattern is covered by the dry run, not by source reading.
- Lightweight tags without git notes get default channel `[null]`, valid for `main`.
- Order in core: `verifyAuth` (`git push --dry-run`) → if behind remote, skip release → `verifyConditions` → analyze → `prepare` (changelog, npm version, git commit+push) → tag push → `publish` → `success`. Git push happens before any publish.
- npm plugin: `verifyConditions` exchanges the OIDC token (`getIDToken("npm:registry.npmjs.org")`) only when registry is the official one; on failure it falls back to `NPM_TOKEN` and throws `ENONPMTOKEN`. Publish runs `npm publish <cwd> --userconfig <tmp> --tag latest --registry <registry>`; npm CLI performs OIDC itself. `prepare` runs `npm version <v> --no-git-tag-version`. Lockfile type is irrelevant.

## Data Flow

    workflow_dispatch (dry_run) ──→ cd.yml
                   ├─ ci (uses ci.yml, contents: read)
                   └─ release (needs ci; only if ref == refs/heads/main)
                        semantic-release [--dry-run when dry_run: stops after analysis, no writes]
                        ├ prepare: CHANGELOG → package.json → commit "[skip ci]" → push
                        ├ tag vX.Y.Z → push
                        ├ publish: npm (OIDC, provenance) → GH Packages (GITHUB_TOKEN) → GitHub Release
                        └ success: issue/PR comments

## File Changes

| File                                  | Action | Description                                                                                                                                                                                 |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/cd.yml`            | Create | CD workflow                                                                                                                                                                                 |
| `.github/workflows/ci.yml`            | Modify | `workflow_call`; concurrency group/cancel                                                                                                                                                   |
| `.releaserc.json`                     | Create | semantic-release config                                                                                                                                                                     |
| `.github/github-packages.npmrc`       | Create | `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`                                                                                                                                          |
| `package.json`, `pnpm-lock.yaml`      | Modify | devDeps: `semantic-release@^25`, `@semantic-release/changelog`, `@semantic-release/git`, `@semantic-release/exec`, `conventional-changelog-conventionalcommits` (bundled plugins not added) |
| `.prettierignore`, `eslint.config.js` | Modify | Ignore `CHANGELOG.md` (ESLint entry is defensive: ESLint does not lint `.md` today)                                                                                                         |
| `docs/releasing.md`                   | Create | Bootstrap, recovery runbook                                                                                                                                                                 |
| `README.md`                           | Modify | Short "Releasing" pointer under Development                                                                                                                                                 |
| `test/release-config.test.ts`         | Create | Config contract tests                                                                                                                                                                       |

## Interfaces / Contracts

`ci.yml` delta:

```yaml
on:
  pull_request:
    branches: [main]
  workflow_call:
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

`cd.yml`:

```yaml
name: CD
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: Report the next version without publishing
        type: boolean
        default: false
permissions: {}
jobs:
  ci:
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read
  release:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    concurrency:
      group: release-${{ github.ref }}
      cancel-in-progress: false
    permissions:
      contents: write
      issues: write
      pull-requests: write
      packages: write
      id-token: write
    env:
      HUSKY: '0'
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: npm install -g npm@11 && npm --version
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec semantic-release ${{ inputs.dry_run && '--dry-run' || '' }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.releaserc.json` (plugin order is load-bearing: npm before exec before github; changelog and npm before git):

```json
{
  "branches": ["main"],
  "tagFormat": "v${version}",
  "plugins": [
    ["@semantic-release/commit-analyzer", { "preset": "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { "preset": "conventionalcommits" }],
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    "@semantic-release/npm",
    [
      "@semantic-release/exec",
      {
        "publishCmd": "npm publish --ignore-scripts --provenance=false --registry https://npm.pkg.github.com --userconfig .github/github-packages.npmrc"
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

No custom `releaseRules`: breaking changes follow default semver (major), `feat` minor, `fix`/`perf` patch. The release-notes generator lists `BREAKING CHANGES` in `CHANGELOG.md`.

Concurrency note: the `release-${{ github.ref }}` group serializes dispatches on `main` without cancelling a running release; a dry run shares the group, so it queues behind a real release.

`--ignore-scripts` on the second publish reuses `dist/` built by `prepublishOnly` during the npm publish.

**Failure handling**: npm publish fails → tag and release commit already pushed; no GH Packages, no GitHub Release; runbook: delete remote tag, revert release commit, re-dispatch `CD` on `main`, or publish manually. GH Packages fails → npm has the version, no GitHub Release; runbook: manual `npm publish --registry https://npm.pkg.github.com` from the tag, then `gh release create`.

**Loop avoidance**: pushes made with `GITHUB_TOKEN` do not start workflow runs; `[skip ci]` is a second guard.

## Testing Strategy

| Layer         | What                                                                                                                                                                                                                                                                                                                             | Approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (vitest) | `.releaserc.json` plugin order, `[skip ci]`, assets; `package.json` has no `publishConfig.registry`; `cd.yml` text contains `id-token: write` once, `npm@11`, `HUSKY`, `workflow_dispatch`, `dry_run`, `refs/heads/main` and no `push:` trigger; `CHANGELOG.md` ignored by Prettier (`getFileInfo`) and ESLint (`isPathIgnored`) | RED first, text/JSON assertions (no YAML parser dep), like `test/tooling.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Static        | Workflow syntax                                                                                                                                                                                                                                                                                                                  | `actionlint` locally; `pnpm run lint`, `format:check`, `typecheck`, `test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dry run       | Version continuity                                                                                                                                                                                                                                                                                                               | Scratch clone: `git tag v0.1.0` on a main commit, `pnpm exec semantic-release --dry-run --no-ci --branches <branch> --plugins @semantic-release/commit-analyzer,@semantic-release/release-notes-generator` on a `feat` commit → expect `0.2.0`. Second scratch clone (must load the real `.releaserc.json` plugin options, so use a config limited to commit-analyzer and release-notes-generator with the same preset, not the bare `--plugins` list, which drops plugin options): fake tag `v0.1.0` plus a `feat!: ...` commit (also a variant with a `BREAKING CHANGE:` footer) → expect `1.0.0`; `feat` alone → `0.2.0`, `fix` alone → `0.1.1` |
| Post-merge    | OIDC + push auth                                                                                                                                                                                                                                                                                                                 | Merge this PR as `ci:` (no CD run is triggered); first real validation is a `dry_run` dispatch on `main`: must log "OIDC token exchange ... succeeded", report the next version or "no relevant changes", and create no commit, tag or Release                                                                                                                                                                                                                                                                                                                                                                                                     |

## Threat Matrix

| Boundary                 | Applicability                         | Design response                                                 | RED tests                                                                          |
| ------------------------ | ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Documentation-like paths | N/A: no file classification           | —                                                               | —                                                                                  |
| Git repository selection | N/A: single checkout, cwd = repo root | —                                                               | —                                                                                  |
| Commit state             | Applicable                            | Only `assets` committed; hooks disabled by `HUSKY=0`            | Assert assets list and `HUSKY` in `cd.yml`                                         |
| Push state               | Applicable                            | `HEAD:main` + tags with `GITHUB_TOKEN`; behind-remote runs skip | Assert `fetch-depth: 0`, `persist-credentials: false`, `cancel-in-progress: false` |
| PR commands              | N/A: no PR creation                   | —                                                               | —                                                                                  |

## Migration / Rollout

1. Bootstrap PR `chore(release): 0.1.0` (version only); merge.
2. On that `main` commit: `pnpm install --frozen-lockfile`, `npm login`, `npm publish` (2FA), `git tag v0.1.0 <sha>`, `git push origin v0.1.0`.
3. npmjs.com → package settings → Trusted Publisher: GitHub Actions, owner `JSisques`, repository `shitaku`, workflow `cd.yml`, environment empty.
4. Merge this change as `ci: ...` (kept as convention; merging no longer triggers a release at all). Then dispatch `CD` on `main` with `dry_run` true to validate, and with `dry_run` false to release. Never rename `cd.yml` (the publish lives in `cd.yml`, so the trusted-publisher filename binding holds).

## Review Budget

Authored ≈ 300 lines (cd.yml 45, ci.yml 5, releaserc 30, npmrc 1, package.json 6, ignores 2, docs 100, README 6, test 90) plus OpenSpec artifacts. `pnpm-lock.yaml` adds roughly 1000+ generated lines, excluded from the 400-line count. Risk: Medium.

## Risks

- Dry-run mode must not mutate: confirm `--dry-run` creates no commit, tag, GitHub Release or registry publish (including the exec GH Packages step); validated by the first `dry_run` dispatch.
- Manual dispatch from a non-main branch is blocked by the `release` job guard (`github.ref == 'refs/heads/main'`); `ci` still runs, nothing is published.
- A forgotten dispatch leaves releasable commits unpublished; accepted tradeoff of explicit release control.

## Unverified

- `conventionalcommits` preset `breakingHeaderPattern` (`!` in the header) is not installed locally; covered by the `feat!:` dry run.
- Reusable-workflow semantics: `github.*` resolving to the caller, top-level `concurrency` honored in callee, callee permissions only downgrading the caller's (design is safe either way via literal prefixes and equal `contents: read`).
- npm CLI not attempting OIDC for `npm.pkg.github.com`; `${VAR}` expansion in userconfig (widely documented, not re-read).
- `@semantic-release/exec` lodash templating and current majors of exec/changelog/git/preset (resolve with `pnpm add -D`).

## Open Questions

- None. Resolved: first version is `0.1.0` (bootstrap); afterwards standard semver applies with default commit-analyzer rules.
