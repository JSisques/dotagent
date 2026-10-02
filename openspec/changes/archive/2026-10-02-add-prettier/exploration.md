# Exploration: add-prettier

Source: GitHub issue #10 "chore: add Prettier for code formatting".

## Current State

- No formatter, no `.editorconfig`, no CI.
- `package.json` scripts: `build`, `typecheck`, `test`, `prepublishOnly`. `files`: `dist`, `catalog`, `README.md`.
- `openspec/config.yaml` has `testing.formatter: null`.
- Existing TS style (37 files under `src/` and `test/`): single quotes, semicolons, 2-space indent, trailing commas, long lines.

## Line-Length Measurements (TS files)

| Threshold | Lines over |
| --------- | ---------- |
| > 80      | 328        |
| > 100     | 138        |
| > 120     | 42         |
| > 140     | 12         |
| > 160     | 3          |

## Options Considered

| printWidth | Estimated TS lines rewrapped | Fit with 400-line budget |
| ---------- | ---------------------------- | ------------------------ |
| 80         | ~328 (plus rewrap expansion) | Too large                |
| 120        | ~42 lines in ~14 files       | Fits                     |
| 160        | ~3                           | Smallest diff            |

Explorer recommended 160; user confirmed 120.

## Affected Areas

- `package.json` (devDependency, `format` and `format:check` scripts)
- New `.prettierrc` and `.prettierignore`
- `README.md` Development section
- `src/**`, `test/**` (one-time formatting pass)
- `openspec/config.yaml` (`testing.formatter`)

## Notes

- `.atl/` and `openspec/changes/archive/` recommended for `.prettierignore`.
- No shell was available during exploration; diff size is an estimate, not a measurement.
