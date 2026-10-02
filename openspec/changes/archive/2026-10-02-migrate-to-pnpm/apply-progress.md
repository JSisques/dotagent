# Apply Progress: migrate-to-pnpm

Mode: Standard (no strict TDD; tooling-only change). 19/19 tasks complete.

## Completed

- Phase 1 (1.1-1.3): corepack was absent (Node 26), so it was installed into a scratch prefix with `npm i -g --prefix <scratch> corepack`. `corepack pnpm@10 import` created `pnpm-lock.yaml`, `corepack use pnpm@10` pinned `pnpm@10.34.6+sha512...`, `package-lock.json` deleted, `pnpm install` ran with no ignored-build warning.
- Phase 2 (2.1-2.6): package.json prepublishOnly, .prettierignore, three .husky hooks, smoke-pack.mjs lines 2 and 34. 2.7 not needed.
- Phase 3 (3.1-3.2): README and openspec/config.yaml updated (added `testing.command: pnpm test`).
- Phase 4 (4.1-4.7): all verification commands passed (see below).

## Deviation

`test/naming.test.ts` listed `package-lock.json` in its scan ROOTS; it threw ENOENT after deletion. Replaced with `pnpm-lock.yaml` (1 line). Not in the design file list.

## Work Unit Evidence

| Evidence        | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Focused test    | `pnpm install --frozen-lockfile && pnpm test`: 15 files, 114 tests passed          |
| Runtime harness | `pnpm run smoke:pack`: passed (`shitaku --help ok`, `node dist/main.js --help ok`) |
| Rollback        | Revert the PR, then `rm -rf node_modules && npm install`                           |

## Verification observed

- 4.1 frozen install ok; `.husky/_`, commit-msg, pre-commit, pre-push present.
- 4.2 typecheck clean; tests 114/114 (after naming test fix); build ok, check-dist-aliases 21 files clean.
- 4.3 `echo bad | pnpm exec commitlint` exit 1; `feat: ok` exit 0; lint-staged formatted a misformatted staged file; `git push --dry-run` ran typecheck/tests/build (pre-push triggered).
- 4.4 smoke:pack passed. 4.5 format:check passes after prettier on SDD artifacts; lockfile not reported.
- 4.6 residue only smoke-pack line 2 (`npm install`); other hits are `pnpm ...` substrings; README lines 3 and 9 `npx` untouched.
- 4.7 package-lock.json absent, pnpm-lock.yaml present.
