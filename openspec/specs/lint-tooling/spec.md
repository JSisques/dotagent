# Lint Tooling Specification

## Purpose

Defines the lint gate (`pnpm lint`), its rule coverage, its coexistence with Prettier and lint-staged, and the dual-compiler split (TypeScript 6.x for linting, native TypeScript 7 installed as the `typescript-native` alias and invoked by explicit path for typecheck/build).

## Requirements

### Requirement: Lint gate

The system MUST provide a `lint` script that exits 0 when the repository is clean and non-zero on any error-level violation. A `lint:fix` script SHOULD apply autofixes.

#### Scenario: Clean repository passes

- GIVEN the change is applied on the working branch
- WHEN `pnpm lint` runs
- THEN it exits 0 with no errors

#### Scenario: Type-aware violation fails

- GIVEN the violation fixture `test/fixtures/lint/floating-promise.ts` contains an unawaited promise
- WHEN it is linted with ignores disabled (`ignore: false`), as the tooling test does
- THEN it reports `@typescript-eslint/no-floating-promises`

#### Scenario: Violation fixture excluded from the normal run

- GIVEN `test/fixtures/lint` holds deliberate violations
- WHEN `pnpm lint` runs
- THEN the fixture is not reported and the run is unaffected

### Requirement: Type-aware rules for source

The system MUST lint `src/` and `test/` with typescript-eslint `recommendedTypeChecked`, using the project service resolved from the repository root.

#### Scenario: Path aliases resolve

- GIVEN a source file imports via `@/*`
- WHEN it is linted
- THEN no parser or project-service error occurs

### Requirement: Scoped overrides and ignores

Test files MAY have rules relaxed only where justified. `scripts/*.mjs` and `eslint.config.js` MUST be linted without type information and with Node globals. `dist`, `coverage`, `node_modules`, `openspec`, `test/fixtures/lint` and `CHANGELOG.md` MUST be ignored.
(Previously: ignore list lacked `CHANGELOG.md`.)

#### Scenario: Plain-JS scripts

- GIVEN `scripts/*.mjs` uses `process` and `import.meta.dirname`
- WHEN linted
- THEN no `no-undef` or type-info errors are reported

#### Scenario: Ignored paths

- GIVEN a violating file exists under `dist/`
- WHEN `pnpm lint` runs
- THEN the file is not reported

#### Scenario: Changelog ignored

- GIVEN a generated `CHANGELOG.md` exists
- WHEN `pnpm lint` runs
- THEN it is not linted and the run exits 0

### Requirement: Justified disables

Every inline disable comment MUST include a written reason.

#### Scenario: Disable has reason

- GIVEN the repository after the change
- WHEN searching for `eslint-disable` comments
- THEN each one carries a description after `--`

### Requirement: Prettier compatibility

Formatting-related ESLint rules MUST be disabled via `eslint-config-prettier`, placed last in the config. `eslint-plugin-prettier` MUST NOT be used.

#### Scenario: No format conflicts

- GIVEN Prettier-formatted files
- WHEN `pnpm lint` and `pnpm run format:check` run
- THEN both exit 0 and ESLint reports no formatting rule

### Requirement: Pre-commit integration

lint-staged MUST run `eslint --fix` then `prettier --write` on staged `*.{ts,mjs,js}` files. The existing catch-all Prettier entry MUST be narrowed to exclude those extensions (`!(*.{ts,mjs,js})`) so Prettier never runs twice on the same file.

#### Scenario: No duplicate Prettier run

- GIVEN a staged `.ts` file
- WHEN the hook runs
- THEN only the `eslint --fix` then `prettier --write` entry matches it, and the catch-all Prettier entry does not

#### Scenario: Staged violation blocks commit

- GIVEN a staged `.ts` file has an unfixable lint error
- WHEN the pre-commit hook runs
- THEN the commit is aborted

#### Scenario: Autofixable issue

- GIVEN a staged file has an autofixable violation
- WHEN the hook runs
- THEN the fix is applied and the commit proceeds

### Requirement: Explicit compiler split

`typescript` MUST be pinned to 6.x solely for typescript-eslint. Native TypeScript 7 MUST be installed as the pnpm alias `typescript-native` (`npm:typescript@^7.0.2`). `typecheck` and `build` MUST invoke it by explicit path (`node node_modules/typescript-native/bin/tsc`) and MUST NOT rely on the bare `tsc` bin, and MUST pass with the native TS 7 compiler. The `build` pipeline MUST still run alias rewriting and `check-dist-aliases.mjs`.

#### Scenario: Typecheck uses the native compiler

- GIVEN both compilers are installed
- WHEN `pnpm run typecheck` runs
- THEN `typescript-native` performs the check via its explicit path and exits 0

#### Scenario: Build emits resolved aliases

- GIVEN a clean `dist/`
- WHEN `pnpm run build` runs
- THEN `dist/` is emitted by `typescript-native` and `check-dist-aliases.mjs` exits 0

#### Scenario: Tooling test guards the split

- GIVEN the vitest tooling test
- WHEN `pnpm test` runs
- THEN it asserts the installed `typescript` major is 6 and `typescript-native` major is 7
- AND the `typecheck` and `build` scripts use the explicit `typescript-native` path with no bare `tsc` token
- AND every `eslint-disable` in `src`, `test` and `scripts` carries a `--` reason

#### Scenario: Existing gates unaffected

- GIVEN the change is applied
- WHEN `pnpm test` and `pnpm run format:check` run
- THEN both pass
