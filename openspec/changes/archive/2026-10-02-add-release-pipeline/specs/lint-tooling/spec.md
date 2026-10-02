# Delta for Lint Tooling

## MODIFIED Requirements

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
