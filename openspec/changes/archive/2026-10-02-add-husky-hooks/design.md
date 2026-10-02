# Design: Add Husky Git Hooks (Issue #11)

## Technical Approach

Repository tooling only; no hexagonal layer is touched. Husky 9 installs via `prepare` and points `core.hooksPath` at `.husky/_`. Three plain-shell hook files call local binaries. Config lives in `package.json` (`lint-staged`) and `commitlint.config.js` (ESM, because `"type": "module"`).

## Architecture Decisions

| Topic                 | Options                                 | Tradeoff                                                                                                                             | Decision                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepare` script      | `husky` / `husky \|\| true`             | `\|\| true` hides real failures and relies on a POSIX `true`                                                                         | `"prepare": "husky"`. Registry/npx installs never run `prepare`. `npm pack`/`publish` run it in the dev checkout, where devDeps and `.git` exist. `HUSKY=0` skips it.                                                                                                                                                                                                                          |
| Binary invocation     | bare name / `npx` / `npx --no --`       | `npx` alone may fetch from the network                                                                                               | `npx --no -- <bin>` (fails fast if missing)                                                                                                                                                                                                                                                                                                                                                    |
| pre-push test command | `npm test` / `npm run test:changed`     | full suite is slower on every push; bare `vitest run --changed` diffs only uncommitted changes, so on a clean tree it finds no tests | `npm run test:changed` = `vitest run --changed origin/main --passWithNoTests`. Diffs committed changes against `origin/main` (verified empirically), runs only affected tests. `--passWithNoTests` lets docs-only pushes pass. Caveat: `origin/main` is the local tracking ref, so it is only as fresh as the last `git fetch`. A change to `package.json`/lockfile/config re-runs everything. |
| lint-staged config    | `package.json` key / `.lintstagedrc`    | extra file                                                                                                                           | `package.json` key                                                                                                                                                                                                                                                                                                                                                                             |
| commitlint config     | `.js` ESM / `.cjs` / `package.json` key | key is less discoverable                                                                                                             | `commitlint.config.js` with `export default`                                                                                                                                                                                                                                                                                                                                                   |
| `.nvmrc`              | `22` / `lts/jod` / `22.22.1`            | `22` can resolve to an installed 22.x below the floor                                                                                | `22.22.1` (exact floor, deterministic for nvm/fnm)                                                                                                                                                                                                                                                                                                                                             |
| `engines.node`        | raise / keep `>=22`                     | raising affects consumers                                                                                                            | Keep it. The dev floor lives in `.nvmrc` and README.                                                                                                                                                                                                                                                                                                                                           |

## Resolved Verification Points

1. **tsconfig/build**: `tsconfig.json` includes `["src","test","vitest.config.ts"]` and does not set `allowJs`. `tsconfig.build.json` includes only `src`. `commitlint.config.js` is outside both, so `tsc --noEmit` and the build are unaffected. Vitest only includes `test/**/*.test.ts`.
2. **.prettierignore for staged files**: the Prettier 3 CLI (`legacy-cli.mjs` `formatFiles`) checks `isIgnored(filename)` for every expanded path and skips it under `--write`/`--check`. The ignore paths default to `.gitignore` + `.prettierignore`, resolved from the cwd. lint-staged runs from the git root, so a staged `package-lock.json` is skipped silently. `--ignore-unknown` skips extensionless files (hooks, `.nvmrc`).
3. **Hook modes**: Husky 9's runner executes hooks via `sh -e`, so the exec bit is not strictly required. They are still committed as `100755` (`git update-index --chmod=+x`) for robustness. No shebang and no `husky.sh` sourcing (deprecated in v9, and it breaks in v10).
4. **Consumer safety**: `files` = `dist, catalog, README.md`, so `.husky/`, `commitlint.config.js`, and `.nvmrc` are not packed.
5. **README**: extend the existing `## Development` section. Do not add a new one.

## Data Flow

    git commit ─→ .husky/_/pre-commit ─→ .husky/pre-commit ─→ lint-staged ─→ prettier --write (re-stage)
               └→ .husky/_/commit-msg ─→ .husky/commit-msg ─→ commitlint --edit $1
    git push   ─→ .husky/_/pre-push ─→ typecheck → test:changed → build (sh -e: first failure aborts)

## File Changes

| File                   | Action | Description                                     |
| ---------------------- | ------ | ----------------------------------------------- |
| `package.json`         | Modify | `prepare`, `lint-staged` key, 4 devDependencies |
| `package-lock.json`    | Modify | Regenerated by `npm install`                    |
| `.husky/pre-commit`    | Create | mode 100755                                     |
| `.husky/commit-msg`    | Create | mode 100755                                     |
| `.husky/pre-push`      | Create | mode 100755                                     |
| `commitlint.config.js` | Create | Extends conventional                            |
| `.nvmrc`               | Create | `22.22.1`                                       |
| `README.md`            | Modify | Development section                             |

## Interfaces / Contracts

`.husky/pre-commit`:

```sh
npx --no -- lint-staged
```

`.husky/commit-msg`:

```sh
npx --no -- commitlint --edit "$1"
```

`.husky/pre-push`:

```sh
npm run typecheck
npm run test:changed
npm run build
```

`package.json` additions:

```json
"prepare": "husky",
"test:changed": "vitest run --changed origin/main --passWithNoTests",
"lint-staged": { "*": "prettier --write --ignore-unknown" }
```

`commitlint.config.js`:

```js
export default { extends: ['@commitlint/config-conventional'] };
```

README Development additions, after the existing command block: Node `>=22.22.1` for contributors (`nvm use`), a hooks table (pre-commit / commit-msg / pre-push), and the bypass options `git commit --no-verify`, `git push --no-verify`, and `HUSKY=0`.

## Testing Strategy

| Layer      | What               | Approach                                                                                                                              |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke      | Install sets hooks | `git config core.hooksPath` returns `.husky/_`                                                                                        |
| Smoke      | Modes              | `git ls-files -s .husky` shows `100755`                                                                                               |
| Smoke      | pre-commit         | Stage an unformatted `.ts` file, commit, and confirm it is formatted                                                                  |
| Smoke      | commit-msg         | `echo bad \| npx commitlint` exits non-zero                                                                                           |
| Smoke      | pre-push           | A type error blocks `git push`; a failing changed test blocks it; an unrelated test is skipped; a docs-only push passes with no tests |
| Smoke      | Packaging          | `npm pack --dry-run` lists no `.husky`, `commitlint.config.js`, or `.nvmrc`                                                           |
| Regression | Existing suite     | `npm run typecheck && npm test && npm run build` stays green                                                                          |

No Vitest tests are added. The hooks are tooling and are verified manually.

## Threat Matrix

| Boundary                 | Applicability | Design response                                                                                                                          | Planned check                                                           |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Documentation-like paths | N/A           | Hooks do not classify or execute repo files by path                                                                                      | none                                                                    |
| Git repository selection | N/A           | Husky resolves to the repo's own `.git`; no `git -C`                                                                                     | none                                                                    |
| Commit state             | Applicable    | lint-staged stashes unstaged hunks and formats only staged content. `commit -a` stages first. An empty index makes lint-staged exit 0.   | Commit a partially staged file and confirm unstaged hunks are preserved |
| Push state               | Applicable    | pre-push is ref-agnostic and checks the working tree; tests are selected by diff against `origin/main`, which exists without an upstream | Push on a first push (no upstream) and confirm the checks run           |
| PR commands              | N/A           | No PR automation                                                                                                                         | none                                                                    |

## Migration / Rollout

No migration required. Existing clones get the hooks on the next `npm install`. Rollback: revert, then `git config --unset core.hooksPath`.

## Open Questions

- [ ] The lint-staged 17 / commitlint 21 Node floors (22.22.1 / 22.12) come from the proposal. Confirm them from the installed `engines` during apply.
