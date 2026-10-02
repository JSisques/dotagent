# Verify Report: rename-to-shitaku

Mode: standard (strict TDD off). Verdict: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING, 2 SUGGESTION).

## Command evidence

- `npm run build`: exit 0, check-dist-aliases 21 files clean
- `npm test`: exit 0, 15 files, 113 tests passed
- `npm run typecheck`: exit 0
- `npm run format:check`: exit 0
- `npm run smoke:pack`: exit 0, `shitaku --help ok` and `node dist/main.js --help ok`
- `rg -i dotagent -g '!openspec/changes/**' -g '!openspec/specs/**'`: no matches (exit 1)
- `git diff --stat`: 16 files changed, 41 insertions, 37 deletions; nothing under openspec/changes/archive or openspec/specs

## Completeness

Phase 1-3 tasks all checked and match the code. Phase 0 (user steps) and Phase 4 (Engram migration) remain open and out of scope, as intended.

## Spec compliance matrix

| Requirement / Scenario                                | Evidence                                                          | Status                           |
| ----------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| Package Identity / Metadata renamed                   | test/naming.test.ts (name, bin keys); package-lock bin and name   | COMPLIANT                        |
| Package Identity / No legacy name in live file        | naming.test.ts fs walk plus rg clean                              | COMPLIANT                        |
| Smoke Test / Packed package runs                      | smoke:pack passed                                                 | COMPLIANT                        |
| Smoke Test / Broken resolution blocks publish         | prepublishOnly chains smoke:pack; no negative test (pre-existing) | PARTIAL (static)                 |
| Init flow / Program name                              | naming.test.ts asserts `Usage: shitaku`                           | COMPLIANT                        |
| Init flow / Interactive, Non-interactive, Unknown MCP | program.test.ts (unchanged behavior, passing)                     | COMPLIANT                        |
| Backup / Backup taken, Claude wrote, Write failure    | init-mcps and node-fs tests passing; stateDir test                | COMPLIANT                        |
| Manifest / Manifest written                           | journal.test.ts asserts `.claude/.shitaku/manifest.json`          | COMPLIANT                        |
| No legacy state migration / Legacy dir ignored        | No dedicated test; no code path reads `.dotagent` (rg clean)      | PARTIAL (static)                 |
| Git hooks / Package contents                          | `files` whitelist unchanged; no tooling change in diff            | COMPLIANT (static, pre-existing) |

## Checks

- package.json: name `@jsisques/shitaku`, bin `shitaku` only, repository `https://github.com/JSisques/shitaku`.
- program.ts `.name('shitaku')` equals the bin key.
- State dir is `.claude/.shitaku`, single source in journal.ts.
- No `dotagent` read as a legacy path anywhere in src.
- openspec/specs still contains 6 `dotagent` mentions across 4 files; expected, archive updates them.

## Findings

CRITICAL: none.

WARNING:

1. Scenario "Legacy directory ignored" has no covering runtime test. Only static evidence (no legacy reads).

SUGGESTION:

1. Add a test seeding `~/.claude/.dotagent/manifest.json` and asserting `undo` reports nothing and leaves it untouched.
2. After sdd-archive, re-run `rg -i dotagent -g '!openspec/changes/archive/**'` to confirm the live specs are clean.
