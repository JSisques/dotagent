# Module Resolution Specification

## Purpose

Defines how source and test modules reference each other (import aliases), the guarantee that published build output contains no unresolved aliases, and the import-direction rules that protect the layered architecture.

## Requirements

### Requirement: Alias Contract

The project MUST define two import aliases: `@/*` resolving to `src/*` and `@test/*` resolving to `test/*`. Alias specifiers MUST keep the `.js` suffix (for example `@/domain/x.js`). The aliases MUST be configured consistently in `tsconfig.json` `paths` (inherited by `tsconfig.build.json`), in the build rewriting step, and in Vitest `resolve.alias`.

#### Scenario: Typecheck resolves aliases

- GIVEN a module in `src` or `test` imports `@/domain/x.js`
- WHEN `npm run typecheck` runs
- THEN the import resolves to `src/domain/x.ts` and no resolution error is reported

#### Scenario: Tests resolve both aliases

- GIVEN a test imports `@/application/y.js` and `@test/helpers/z.js`
- WHEN `npx vitest run` runs
- THEN both imports resolve to `src/application/y.ts` and `test/helpers/z.ts` and the test executes

### Requirement: Parent-Relative Imports Removed

No import or export specifier in `src` or `test` MUST start with `../`. Same-directory `./` specifiers MAY remain relative. Non-import path expressions (for example `new URL('../catalog/', import.meta.url)` and `join(import.meta.dirname, ..., 'catalog')`) MUST NOT be rewritten.

#### Scenario: No parent-relative specifiers

- GIVEN the codemod has been applied
- WHEN all import and export specifiers in `src` and `test` are scanned
- THEN none begins with `../`

#### Scenario: Catalog path expressions untouched

- GIVEN source that builds catalog paths via `new URL('../catalog/', import.meta.url)`
- WHEN the codemod runs
- THEN those expressions are unchanged and the catalog is still found at runtime

#### Scenario: Same-directory imports preserved

- GIVEN a module importing `./sibling.js`
- WHEN the codemod runs
- THEN the specifier remains `./sibling.js`

### Requirement: Build Output Free of Aliases

The `build` script MUST rewrite alias specifiers in emitted JavaScript after `tsc` using `tsc-alias` against `tsconfig.build.json`. The build MUST fail if any `dist/**/*.js` file still contains an `@/` or `@test/` import specifier. `@test/` code MUST NOT be emitted into `dist`.

#### Scenario: Clean build passes

- GIVEN a source tree using aliases
- WHEN `npm run build` runs
- THEN `dist/**/*.js` contains only relative specifiers and the build exits with code 0

#### Scenario: Surviving alias fails the build

- GIVEN a `dist` JavaScript file containing an `@/` or `@test/` specifier after alias rewriting
- WHEN the post-build guard runs
- THEN the build exits non-zero and reports the offending file

### Requirement: Packed-Install Smoke Test

A smoke script MUST run `npm pack`, install the resulting tarball in a temporary directory, and run `dotagent-cli --help` and `node dist/main.js --help`, both of which MUST exit with code 0. The smoke script MUST be part of `prepublishOnly`.

#### Scenario: Packed package runs

- GIVEN a successful build
- WHEN the smoke script packs and installs the tarball in a temp directory
- THEN `dotagent-cli --help` prints help and exits 0

#### Scenario: Broken resolution blocks publish

- GIVEN a build whose packed output fails to resolve a module at runtime
- WHEN `prepublishOnly` runs
- THEN the smoke script exits non-zero and publishing is aborted

### Requirement: Architecture Import Guards

`test/architecture.test.ts` MUST fail when: any `src` or `test` import specifier starts with `../`; any `src` file imports `@test/`; or any `src/domain` file imports `@/adapters` or `@/application`. Existing domain purity checks MUST remain in force.

#### Scenario: Domain imports adapter

- GIVEN a file in `src/domain` containing `import ... from '@/adapters/x.js'`
- WHEN the architecture test runs
- THEN it fails naming the file

#### Scenario: Source imports test helpers

- GIVEN a file in `src` importing `@test/helpers/z.js`
- WHEN the architecture test runs
- THEN it fails naming the file

#### Scenario: Parent-relative import reintroduced

- GIVEN a file in `src` or `test` importing `../x.js`
- WHEN the architecture test runs
- THEN it fails naming the file

#### Scenario: Compliant tree passes

- GIVEN all imports follow the alias and direction rules
- WHEN the architecture test runs
- THEN it passes

### Requirement: No Behavior Change

The change MUST NOT alter runtime behavior, package `exports`, or bundling. The existing `typecheck`, `build`, and test suites MUST pass unchanged apart from import specifiers.

#### Scenario: Full pipeline green

- GIVEN the alias wiring and codemod are applied
- WHEN `npm run typecheck`, `npm run build`, and `npx vitest run` run
- THEN all succeed
