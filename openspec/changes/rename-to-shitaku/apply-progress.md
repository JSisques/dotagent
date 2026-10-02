# Apply Progress: rename-to-shitaku

Status: Phases 1-3 complete (tasks 1.1-3.4). Phase 0 (user-only) and Phase 4 (Engram migration) are out of scope and untouched.

## Changes

- Created `test/naming.test.ts` (RED first, then GREEN).
- Renamed literals in src, test, scripts, README, openspec/config.yaml, package.json.
- `scripts/smoke-pack.mjs` now derives the package name and first bin key from `package.json`.
- `package.json` gains `repository`; `package-lock.json` regenerated with `npm install --package-lock-only`.

## Verification

- `npm run build`: ok
- `npm test`: 15 files, 113 tests passed
- `npm run typecheck`: ok
- `npm run format:check`: ok
- `npm run smoke:pack`: ok (`shitaku --help`)
- `rg -i dotagent -g '!openspec/changes/**' -g '!openspec/specs/**'`: no matches
