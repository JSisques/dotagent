# Design: Rename dotagent to shitaku

## Technical Approach

A mechanical rename of string literals across live files, plus two small hardening moves: `scripts/smoke-pack.mjs` derives the bin and package path from `package.json`, and a new test guards against the old name returning. There are no structural or port changes. The domain layer only loses one word in a user-visible reason string and in comments.

## Architecture Decisions

| Topic                 | Options                                                                       | Tradeoff                                                                                                                                         | Decision                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| State-dir source      | Keep `stateDir()` in `src/application/journal.ts` vs a new constant elsewhere | `stateDir()` is already the single source; `manifestPath` and backups derive from it                                                             | Keep it; change only the literal to `.shitaku`                                                             |
| Product-name constant | One `PRODUCT_NAME` shared by all layers vs literals                           | The 4 src uses have different shapes (path segment, temp suffix, CLI name, reason text). A shared constant would cross layers for one-word reuse | Literals; the guard test makes drift detectable                                                            |
| Smoke-pack paths      | Hard-coded `shitaku` vs read `package.json` (`name`, first `bin` key)         | Reading the manifest removes the "path drift" risk from the proposal                                                                             | Read `package.json` at the start of the script                                                             |
| bin/name consistency  | Manual vs test                                                                | A test is cheap and fails fast                                                                                                                   | New test: `bin` key === `shitaku`, `name` === `@jsisques/shitaku`, `runCli --help` prints `Usage: shitaku` |
| Old-name guard        | `git ls-files` subprocess vs filesystem walk of explicit roots                | A walk adds no process boundary and no git dependency                                                                                            | Filesystem walk in Vitest                                                                                  |
| Test HOME prefix      | Rename both sides vs share a constant                                         | `test/setup.ts` cannot import test helpers before mocks load                                                                                     | Rename `setup.ts` and `architecture.test.ts` in the same commit                                            |
| Lockfile              | Hand edit vs regenerate                                                       | Regeneration avoids format drift                                                                                                                 | `npm install --package-lock-only`                                                                          |
| State migration       | Fallback/move vs none                                                         | Package is unpublished (npm 404)                                                                                                                 | None (confirmed)                                                                                           |

## File Changes

| File                                                                      | Action | Description                                                             |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `src/application/journal.ts`                                              | Modify | `.claude/.shitaku`; doc comment                                         |
| `src/adapters/fs/node-fs.ts`                                              | Modify | Temp suffix `.shitaku-<hex>.tmp`                                        |
| `src/adapters/cli/program.ts`                                             | Modify | `.name('shitaku')`                                                      |
| `src/domain/plan/change-plan.ts`                                          | Modify | Reason `installed by shitaku`; comment                                  |
| `src/domain/manifest.ts`                                                  | Modify | Comments only                                                           |
| `test/setup.ts`, `test/architecture.test.ts`                              | Modify | HOME prefix `shitaku-home-`                                             |
| `test/helpers/tmp-paths.ts`                                               | Modify | Prefix `shitaku-test-`                                                  |
| `test/application/journal.test.ts`                                        | Modify | Path assertions                                                         |
| `test/adapters/cli/program.test.ts`                                       | Modify | argv and manifest path                                                  |
| `test/application/init-mcps.test.ts`                                      | Modify | Test title                                                              |
| `test/naming.test.ts`                                                     | Create | Old-name guard and bin/name consistency                                 |
| `scripts/smoke-pack.mjs`                                                  | Modify | Read name/bin from `package.json`; temp prefix `shitaku-smoke-`         |
| `package.json`                                                            | Modify | `name`, `bin`, add `repository` (`https://github.com/JSisques/shitaku`) |
| `package-lock.json`                                                       | Modify | Regenerated                                                             |
| `README.md`, `openspec/config.yaml`                                       | Modify | Rename; drop the "binary clash" sentence                                |
| `openspec/specs/{module-resolution,install-safety,mcp-install,git-hooks}` | Modify | Via delta specs at archive time                                         |

## Interfaces / Contracts

Guard test sketch (pattern built from parts so the file does not match itself):

```ts
const OLD = new RegExp(['dot', 'agent'].join(''), 'i');
const ROOTS = [
  'src',
  'test',
  'scripts',
  'catalog',
  'openspec/config.yaml',
  'README.md',
  'package.json',
  'package-lock.json',
];
// openspec/changes/** (active and archive) is excluded on purpose.
```

## Execution Order

1. User: `gh repo rename shitaku`; `git remote set-url origin git@github.com:JSisques/shitaku.git`; optional local directory rename (restart the session afterwards).
2. Code changes on a branch, guard test first (RED), then the rename (GREEN).
3. Verification (below).
4. PR, merge.
5. Engram migration (runbook below).

## Testing Strategy

| Layer       | What                                          | Approach                       |
| ----------- | --------------------------------------------- | ------------------------------ |
| Unit        | State path, temp suffix, reason, CLI name     | Existing tests, updated values |
| Guard       | No old name in live files; bin/name/CLI agree | `test/naming.test.ts`          |
| E2E (smoke) | Packed tarball runs `shitaku --help`          | `npm run smoke:pack`           |

Verification commands: `npm run format` scoped to the change folder if needed, then `npm run build && npm test && npm run typecheck && npm run format:check && npm run smoke:pack`, plus `rg -i dotagent -g '!openspec/changes/**'`.

## Threat Matrix

| Boundary                 | Applicability                                     |
| ------------------------ | ------------------------------------------------- |
| Documentation-like paths | N/A: no file classification changes               |
| Git repository selection | N/A: the guard walks the filesystem; no git calls |
| Commit state             | N/A: no commit automation                         |
| Push state               | N/A: remote change is a manual user step          |
| PR commands              | N/A: no PR automation                             |

The smoke script already spawns processes with `shell: false` and fixed argv; only the bin name source changes, read from the local `package.json`.

## Migration / Rollout

No state migration. Engram runbook:

1. Confirm `mem_current_project` reports `shitaku`.
2. Pick one low-value observation; run `engram projects rescue-ownership --project shitaku --observation <id>`.
3. `mem_search` under `shitaku` must return it; under `dotagent` it must be gone.
4. If OK, move the remaining observations, sessions, and prompts in batches, recording IDs for rollback.
5. If step 2 or 3 fails: stop, leave history under `dotagent`, run a fresh `sdd-init/shitaku`.
6. Never edit the SQLite file by hand. Historical topic keys keep their names.

## Review Workload

About 60-90 changed lines of code and tests, plus the regenerated lockfile and docs. Well under the 400-line budget: single PR.

## Open Questions

- [ ] Exact `rescue-ownership` flags must be confirmed with `engram projects rescue-ownership --help` before step 2.
