# Delta for module-resolution

## MODIFIED Requirements

### Requirement: Alias Contract

The project MUST define two import aliases: `@/*` resolving to `src/*` and `@test/*` resolving to `test/*`. Alias specifiers MUST keep the `.js` suffix (for example `@/domain/x.js`). The aliases MUST be configured consistently in `tsconfig.json` `paths` (inherited by `tsconfig.build.json`), in the build rewriting step, and in Vitest `resolve.alias`.
(Previously: scenarios used `npm run typecheck` and `npx vitest run`)

#### Scenario: Typecheck resolves aliases

- GIVEN a module in `src` or `test` imports `@/domain/x.js`
- WHEN `pnpm run typecheck` runs
- THEN the import resolves to `src/domain/x.ts` and no resolution error is reported

#### Scenario: Tests resolve both aliases

- GIVEN a test imports `@/application/y.js` and `@test/helpers/z.js`
- WHEN `pnpm exec vitest run` runs
- THEN both imports resolve to `src/application/y.ts` and `test/helpers/z.ts` and the test executes

### Requirement: Packed-Install Smoke Test

A smoke script MUST run `npm pack`, install the resulting tarball in a temporary directory, and run `shitaku --help` and `node dist/main.js --help`, both of which MUST exit with code 0. The script MUST keep using npm (it simulates a consumer install). The smoke script MUST be part of `prepublishOnly`, which MUST invoke scripts via `pnpm run`.
(Previously: `prepublishOnly` used npm)

#### Scenario: Packed package runs

- GIVEN a successful build
- WHEN the smoke script packs and installs the tarball in a temp directory
- THEN `shitaku --help` prints help and exits 0

#### Scenario: Broken resolution blocks publish

- GIVEN a build whose packed output fails to resolve a module at runtime
- WHEN `prepublishOnly` runs
- THEN the smoke script exits non-zero and publishing is aborted

### Requirement: No Behavior Change

The change MUST NOT alter runtime behavior, package `exports`, or bundling. The existing `typecheck`, `build`, and test suites MUST pass unchanged apart from import specifiers.
(Previously: pipeline commands were npm-based)

#### Scenario: Full pipeline green

- GIVEN the alias wiring and codemod are applied
- WHEN `pnpm run typecheck`, `pnpm run build`, and `pnpm exec vitest run` run
- THEN all succeed

## ADDED Requirements

### Requirement: Package Identity

`package.json` MUST declare `name` as `@jsisques/shitaku`, a `bin` entry named `shitaku` (and no `dotagent-cli` entry), and `repository` pointing to `https://github.com/JSisques/shitaku`. `pnpm-lock.yaml` MUST be consistent with these values.
(Reason: Archive of migration to pnpm)

#### Scenario: Metadata renamed

- GIVEN the repository root
- WHEN `package.json` and `pnpm-lock.yaml` are read
- THEN the name is `@jsisques/shitaku`, `bin` exposes only `shitaku`, and `repository` is the shitaku URL

#### Scenario: No legacy name in live files

- GIVEN all tracked files outside `openspec/changes/archive`
- WHEN searched case-insensitively for `dotagent`
- THEN no match is found
