# Proposal: Migrate developer tooling from npm to pnpm

## Intent

Issue #19: switch contributor tooling for `@jsisques/shitaku` to pnpm for faster, stricter installs and one reproducible lockfile. Consumer usage (`npx @jsisques/shitaku`) is unchanged.

## Scope

### In Scope

- `package.json`: add `packageManager` (pnpm 10.x); `prepublishOnly` uses `pnpm run`
- Lockfile: generate `pnpm-lock.yaml` via `pnpm import`; delete `package-lock.json`
- `.prettierignore`: `package-lock.json` -> `pnpm-lock.yaml`
- `.husky/pre-commit`, `.husky/commit-msg`: `npx --no --` -> `pnpm exec`; `.husky/pre-push`: `pnpm run`
- `README.md`: Development section, hooks table, corepack setup note, smoke-pack npm exception
- `openspec/config.yaml`: test/typecheck/format/verify commands use pnpm
- `scripts/smoke-pack.mjs`: comment (line 2) only

### Out of Scope

- smoke-pack logic: keeps `npm pack`/`npm install` (simulates a consumer install)
- Consumer `npx` docs (README lines 3, 9)
- CI (none exists), workspaces, `.npmrc` tuning, dependency upgrades

## Decisions

- Pin pnpm via `corepack use pnpm@10` (writes the latest 10.x with hash); apply records the exact version.
- No `engines.pnpm`: it adds no enforcement beyond `packageManager` and is published metadata.
- "No npm commands" means developer commands; smoke-pack is the documented exception.

## Capabilities

### New Capabilities

- `package-manager`: pnpm is the contributor package manager (`packageManager` field, `pnpm-lock.yaml` only, corepack setup documented, no developer npm commands).

### Modified Capabilities

- `git-hooks`: hook install triggered by `pnpm install`; pre-push runs `pnpm run typecheck|test:changed|build`.
- `module-resolution`: Package Identity lockfile consistency references `pnpm-lock.yaml`; dev commands use pnpm (smoke-pack stays npm).

## Approach

Full switch (exploration Approach 1): `pnpm import` preserves resolved versions, then `pnpm install` verifies. Mechanical text replacement elsewhere. Hexagonal layers affected: none (tooling/docs only; `src/` untouched).

## Affected Areas

| Area                                      | Impact   | Description                        |
| ----------------------------------------- | -------- | ---------------------------------- |
| `package.json`                            | Modified | `packageManager`, `prepublishOnly` |
| `package-lock.json`                       | Removed  | replaced                           |
| `pnpm-lock.yaml`                          | New      | generated                          |
| `.prettierignore`                         | Modified | lockfile entry                     |
| `.husky/{pre-commit,commit-msg,pre-push}` | Modified | pnpm commands                      |
| `README.md`                               | Modified | Development docs                   |
| `openspec/config.yaml`                    | Modified | commands                           |
| `scripts/smoke-pack.mjs`                  | Modified | comment only                       |

## Risks

| Risk                                             | Likelihood | Mitigation                                                                                          |
| ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| pnpm 10 blocks dependency lifecycle scripts      | Med        | Check install warnings; add `pnpm.onlyBuiltDependencies` only if needed (root `prepare` still runs) |
| Phantom dependencies surface under strict layout | Low        | Run typecheck, test, build, smoke:pack after install                                                |
| Contributors without pnpm                        | Med        | Document `corepack enable`; `packageManager` makes corepack fetch the pinned version                |
| Generated lockfile inflates diff                 | High       | Exclude from 400-line authored budget                                                               |

## Rollback Plan

Revert the PR (restores `package-lock.json` and npm commands), then `rm -rf node_modules && npm install`.

## Dependencies

- Node >=22 with corepack; pnpm 10.x

## Success Criteria

- [ ] `pnpm install` on a fresh clone installs deps and Husky hooks
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run build`, `pnpm run format:check` pass
- [ ] Hooks run via pnpm and still block bad commits/pushes
- [ ] `package-lock.json` absent; `pnpm-lock.yaml` committed
- [ ] README documents pnpm/corepack and no developer npm commands remain (smoke-pack exception noted)
- [ ] `pnpm run smoke:pack` passes; `npx @jsisques/shitaku` unchanged
