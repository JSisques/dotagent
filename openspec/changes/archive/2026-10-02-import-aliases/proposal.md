# Proposal: Replace deep relative imports with `@/` aliases (issue #12)

## Intent

103 relative imports (67 at `../../` or deeper) make the four layers (domain, ports, application, adapters) brittle to move and hard to read. Replace parent-relative imports with stable aliases, and keep the published binary working.

## Scope

### In Scope

- Alias shape (decided):
  - `@/*` -> `src/*` (production and tests).
  - `@test/*` -> `test/*` (dev only, used for `test/helpers`).
  - Specifiers keep the `.js` suffix (`@/domain/x.js`). Same-directory `./` imports stay relative. All `../` import specifiers are rewritten.
- Wiring: `paths` in `tsconfig.json` (inherited by `tsconfig.build.json`), `tsc-alias -p tsconfig.build.json` after `tsc` in `build`, and Vitest `resolve.alias` for both prefixes.
- Post-build guard: fail the build if `dist/**/*.js` still contains `@/` or `@test/` specifiers.
- Packed-install smoke test: `npm pack`, install in a temp dir, run `dotagent-cli --help` (and `node dist/main.js --help`). Add it to `prepublishOnly`.
- Architecture guards in `test/architecture.test.ts`: no `../` import specifiers in `src`/`test`, `src` never imports `@test/`, and domain never imports `@/adapters` or `@/application`. Existing purity regexes stay.
- Codemod plus Prettier.

### Out of Scope

- Node subpath imports (approach A), bundling, and `exports` changes.
- Rewriting `new URL('../catalog/', import.meta.url)` or `join(import.meta.dirname, ..., 'catalog')`.

## Capabilities

### New Capabilities

- `module-resolution`: alias contract, the guarantee that `dist` has no unresolved aliases, packed-install smoke, and import-direction guards.

### Modified Capabilities

- None

## Approach

Approach B, chosen by the maintainer. Why a single `@/` root: one mapping in each of the three places (tsconfig, tsc-alias, Vitest) keeps drift small, and the layer stays visible in the path (`@/ports/...`). `@test/` keeps test-only code out of `src` and never reaches `dist`, because the build only includes `src`.

Commits:

1. Config wiring, the dist guard, the smoke test and the direction guards (`src` never imports `@test/`; domain never imports `@/adapters` or `@/application`).
2. The mechanical codemod, Prettier and the no-`../` specifier guard (it can only pass after the codemod).

## Affected Areas

| Area                                                                | Impact   | Description                                                        |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `package.json`                                                      | Modified | `tsc-alias` devDependency, `build`, smoke script, `prepublishOnly` |
| `tsconfig.json`                                                     | Modified | `paths`                                                            |
| `vitest.config.ts`                                                  | Modified | `resolve.alias`                                                    |
| `test/architecture.test.ts`                                         | Modified | new guards                                                         |
| `scripts/`                                                          | New      | dist guard and pack smoke                                          |
| `src/{domain,ports,application,adapters}`, `src/main.ts`, `test/**` | Modified | specifiers only, no behavior change                                |

## Risks

| Risk                                                                           | Likelihood | Mitigation                                  |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------- |
| Aliases leak into `dist` (false green)                                         | Med        | dist guard plus packed smoke                |
| `tsc-alias` is not compatible with TS 7 or with `paths` that have no `baseUrl` | Med        | spike first; set `baseUrl` only if required |
| Vite does not map `.js` to `.ts` through the alias                             | Low        | spike in commit 1                           |
| Codemod rewrites catalog paths                                                 | Low        | rewrite only import/export specifiers       |

## Rollback Plan

Revert commit 2 (the codemod), then commit 1 (the config). Relative imports come back unchanged and nothing outside the build changes.

## Dependencies

- `tsc-alias` (devDependency).

## Success Criteria

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] No `../` import specifiers remain in `src` or `test`.
- [ ] `dist` contains no `@/` or `@test/` specifiers.
- [ ] The packed install runs `dotagent-cli --help` successfully.
- [ ] The architecture guards pass.
