# Verify Report: migrate-to-pnpm

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 3 SUGGESTION)
**Tasks**: 19/19 complete. **Requirements**: 11. **Scenarios**: 21.

> Persisted without `gentle-ai sdd-verify-validate`: the installed gentle-ai 3.7.0 does not provide that subcommand. Persistence was explicitly authorized by the maintainer.

## Real execution

Node 26.7.0, global pnpm 10.34.6 (equal to the `packageManager` pin). Corepack is not installed, so `corepack pnpm@10` was not exercised.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0, Husky `prepare` ran |
| `pnpm run typecheck` | exit 0 |
| `pnpm test` | exit 0, 15 files, 114/114 passed |
| `pnpm run build` | exit 0, check-dist-aliases 21 files clean |
| `pnpm run smoke:pack` | exit 0 |
| `pnpm run format:check` | exit 0, lockfile not reported |
| `echo bad \| pnpm exec commitlint` | exit 1 (expected) |
| `git config core.hooksPath` | `.husky/_` |
| `npm pack --dry-run` | 28 files (dist + package.json only); consumer-safety holds |

## Static checks

- `package-lock.json` absent; `pnpm-lock.yaml` present.
- `packageManager` is `pnpm@10.34.6+sha512...`; no `engines.pnpm`.
- Three Husky hooks match the spec; `prepublishOnly` uses pnpm; `.prettierignore` updated.
- `openspec/config.yaml` updated.
- `scripts/smoke-pack.mjs` diff is exactly lines 2 and 34; npm pack/install logic untouched.
- README lines 3 and 9 (`npx @jsisques/shitaku`) untouched; corepack and smoke-pack exception documented.
- Unplanned `test/naming.test.ts` change (ROOTS `package-lock.json` to `pnpm-lock.yaml`) is correct and required (ENOENT otherwise).

## CRITICAL

None.

## WARNING

- **W1 (resolved)**: the "Docs and tooling" scenario required no `npm install` match, but README and `smoke-pack.mjs` mention it as a documented note/exception. Resolved by rewording the spec scenario to exclude the "not supported" note and the smoke-pack exception.
- **W2 (resolved)**: the README corepack note did not cover an existing global pnpm conflicting with a global Corepack install. Resolved by adding a sentence to the README.
- **W3 (open, low risk)**: `corepack pnpm@10` could not be exercised because Corepack is absent; the global pnpm equals the pinned version.

## SUGGESTION

- **S1 (applied via W2)**: README sentence about skipping Corepack when a global pnpm exists.
- **S2**: `openspec/specs/module-resolution/spec.md` lines 65 and 71 still mention `dotagent-cli`. This predates the change; archive merging the delta will fix it.
- **S3**: pre-push blocking scenarios were not re-run end to end (no push made); they rely on static inspection and apply's `git push --dry-run` evidence.

## Next

`sdd-archive`.
