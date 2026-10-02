# Archive Report: dotagent-mvp

**Change**: dotagent-mvp  
**Archived to**: `openspec/changes/archive/2026-10-02-dotagent-mvp/`  
**Archive date**: 2026-10-02  
**Project**: dotagent  
**Artifact store**: hybrid (openspec + engram)

## Executive Summary

The dotagent MVP change has been fully implemented, verified (PASS WITH WARNINGS), and archived. All three capability specs (catalog, mcp-install, install-safety) have been synced to main specs under `openspec/specs/`. The change folder has been moved to archive with date prefix. The only open item is Task 6.5 (manual verification of `${VAR}` expansion in user-scope `~/.claude.json`), which is intentionally carried as a follow-up before the first npm release and documented in the README as a known limitation.

## Verification Status

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 4 SUGGESTION)

From `verify-report.md` at verification time:
- 107 tests passed (14 files)
- typecheck: exit 0
- build: exit 0
- All 33 scenarios (16 requirements) covered: 32 fully, 1 partial
- Coverage measurement: not available (`@vitest/coverage-v8` not installed)
- Package validation: `npm pack --dry-run` produces 28 files, 12.2 kB, no test/src/openspec/.atl included

**Warnings**:
- W1: Task 6.5 open; `${VAR}` expansion in user-scope `~/.claude.json` is unverified. README carries a Known limitation note.
- W2: "Write failure" scenario (install-safety) covered only at the NodeFileSystem unit level, not through apply/CLI path.
- W3: `gentle-ai sdd-verify-validate` unavailable; report not validated by the command.
- W4: Coverage could not be measured (`@vitest/coverage-v8` not installed).

**Suggestions** (not blocking):
- S1: PRs 2, 3, 4 and 6 exceeded the 400-line budget (user-approved with size:exception).
- S2: Add test for interactive mode with no TTY and no flags.
- S3: Add assertion that home/cwd are empty after "Missing source" failure.
- S4: Follow up on undo `--id` newest-only message gap.

**No CRITICAL issues block archive.**

## Task Completion

**Final state**: 25 of 26 implementation tasks complete.

**Open task (intentionally carried as follow-up)**:
- Task 6.5 (PR6): Manual check that `${VAR}` expands for user-scope entries in the real `~/.claude.json`
  - Status: OPEN (not implemented)
  - Rationale: Identified as a design open question; to be performed by user before first npm release
  - Tracking: README.md documents as a known limitation and recommends project scope for env placeholders
  - Per final-state facts: "remains OPEN and is carried as a follow-up before the first npm release"

**Archive-time reconciliation**: No stale checkboxes required reconciliation. Task 6.5 remains unchecked and is explicitly approved as an open follow-up per the launch prompt's final-state facts.

All other 25 tasks (PR1 items 1–4, PR2 items 1–6, PR3 items 1–6, PR4 items 1–4, PR5 items 1–2, PR6 items 1–4) are complete.

## Specs Synced

All delta specs were ADDED requirements (new capabilities). Since no main specs existed prior, each delta spec became the full canonical spec for its domain.

| Domain | Destination | Requirements | Action |
|--------|-------------|--------------|--------|
| catalog | `openspec/specs/catalog/spec.md` | 7 requirements, 11 scenarios | Created (mechanical copy) |
| mcp-install | `openspec/specs/mcp-install/spec.md` | 10 requirements, 13 scenarios | Created (mechanical copy) |
| install-safety | `openspec/specs/install-safety/spec.md` | 13 requirements, 9 scenarios | Created (mechanical copy) |

**Totals**: 30 requirements across 3 domains; 33 scenarios total.

**Merge method**: Mechanical `cp -R` with `diff -r` verification (no main specs existed, so no composition required). Empty diff confirms byte-for-byte fidelity.

## Archive Contents

All artifacts from the change folder have been moved to `openspec/changes/archive/2026-10-02-dotagent-mvp/`:

- ✅ `proposal.md` — original proposal; defines scope and approach
- ✅ `specs/catalog/spec.md` — catalog capability specification (now main spec)
- ✅ `specs/mcp-install/spec.md` — MCP install capability specification (now main spec)
- ✅ `specs/install-safety/spec.md` — install safety capability specification (now main spec)
- ✅ `design.md` — design decisions and architecture
- ✅ `tasks.md` — task breakdown (25 of 26 complete)
- ✅ `verify-report.md` — verification evidence and test results
- ✅ `apply-progress.md` — implementation progress notes
- ✅ `exploration.md` — exploration artifacts

## Source of Truth Updated

The following main specs are now authoritative and reflect the dotagent MVP behavior:
- `openspec/specs/catalog/spec.md` (7 requirements, 11 scenarios)
- `openspec/specs/mcp-install/spec.md` (10 requirements, 13 scenarios)
- `openspec/specs/install-safety/spec.md` (13 requirements, 9 scenarios)

The active change folder `openspec/changes/dotagent-mvp` has been removed. Future changes will use new change folders and can reference or extend these canonical specs.

## Mechanical Archive Verification

Per the Mechanical Copy Contract (skill Step 2 and 3):
- All specs synced via `cp -R` with `diff -r` verification: empty diff ✓
- Change folder moved via `mv` with pre-move snapshot and post-move `diff -r`: empty diff ✓
- Archive directory confirmed: all required artifacts present ✓
- Active change folder confirmed: removed ✓

## SDD Cycle Complete

The dotagent MVP SDD cycle is closed. The change is:
1. **Implemented**: 6 chained PRs (#2–#7) plus tracker PR #1 merged to main; 107 tests passing
2. **Verified**: PASS WITH WARNINGS (0 critical); 33 scenarios covered
3. **Archived**: All artifacts preserved with date prefix; main specs updated
4. **Tracked**: One intentional open follow-up (Task 6.5) documented

Ready for the next change.

## Follow-up Actions

**Before first npm release**:
- Task 6.5: Manual verification of `${VAR}` expansion in real user-scope `~/.claude.json` (documented in README as known limitation)

**Optional enhancements** (from verify suggestions):
- S1: Review size exceptions for PRs 2–4, 6 (approved as part of MVP strategy)
- S2: Add interactive-mode-with-no-TTY test
- S3: Add assertion for empty home/cwd after source-missing failure
- S4: Implement undo `--id` newest-only message

**Candidate follow-up change** (noted in final-state facts):
- Import alias adoption (Node "imports" with `#` prefix or `@/` with tsc-alias) to replace ~100 relative imports—not started, pending user prioritization.
