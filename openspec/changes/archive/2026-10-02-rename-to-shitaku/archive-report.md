# Archive Report: rename-to-shitaku

**Date Archived**: 2026-10-02  
**Change Name**: rename-to-shitaku  
**Status**: COMPLETE WITH FOLLOW-UP  
**Archived to**: `openspec/changes/archive/2026-10-02-rename-to-shitaku/`

## Executive Summary

The project rename from `dotagent` to `shitaku` has been successfully completed and archived. All implementation work (phases 1-3) was verified and merged. Delta specs for 4 capabilities have been synced into the main specifications. The change is ready for production. One follow-up workstream (Engram project migration) remains open but is explicitly separate from this cycle.

## Final State Authority

This archive report records the state of the change at close, per the Final-State Authority hierarchy in `skills/sdd-archive/SKILL.md`.

**Sources ranked by authority**:

1. **Persisted tasks artifact**: `openspec/changes/archive/2026-10-02-rename-to-shitaku/tasks.md` — implementation tasks marked complete.
2. **Explicit final-state facts from orchestrator launch prompt**: PR #30 merged to main (fc70b5d), implementation commit c6a889a, verify WARNING fixed with test additions (114 tests), Phase 0 done, Phase 4 separate.
3. **Intermediate snapshots** (`verify-report`, `apply-progress`): Valid history only, not current state.

## Specifications Synced

| Domain | Action | Details |
|--------|--------|---------|
| module-resolution | MODIFIED + ADDED | Added Package Identity requirement (name, bin, repository); modified Packed-Install Smoke Test (bin renamed to `shitaku`) |
| install-safety | MODIFIED + ADDED | Added No legacy state migration requirement; modified Backup and atomic write, Manifest paths |
| mcp-install | MODIFIED | Modified Init flow (command renamed, program name updated); all scenarios remain applicable |
| git-hooks | MODIFIED | Modified Consumer safety reference (bin name update); behavior unchanged |

**Merge Method**: All 4 delta specs were merged into main specs using the native `gentle-ai sdd-archive-compose` command, which matched requirements by name and applied MODIFIED/ADDED sections atomically. No truncation or loss occurred.

## Archive Contents

```
openspec/changes/archive/2026-10-02-rename-to-shitaku/
├── proposal.md ✓
├── design.md ✓
├── tasks.md ✓
├── apply-progress.md ✓
├── verify-report.md ✓
├── specs/
│   ├── module-resolution/spec.md ✓
│   ├── install-safety/spec.md ✓
│   ├── mcp-install/spec.md ✓
│   └── git-hooks/spec.md ✓
└── archive-report.md ✓
```

All 9 artifacts are present and verified.

## Task Completion Status

**Implementation Tasks (Phases 1-3)**: ✓ ALL COMPLETE

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: RED guard test | ✓ 2/2 complete | test/naming.test.ts created and passing |
| Phase 2: Rename (GREEN) | ✓ 11/11 complete | All string literals renamed in src, test, scripts, README, package.json |
| Phase 3: Verification | ✓ 4/4 complete | build, test (114 passing), typecheck, format, smoke:pack all pass |

**User-Only / Post-Merge Tasks**:

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Pre-work | ✓ Done (per launch prompt) | User ran `gh repo rename shitaku`, updated remote to JSisques/shitaku. Local directory rename (optional) not done but not required. |
| Phase 4: Engram migration | ⏳ Open (separate workstream) | Recorded as intentional post-merge follow-up; not part of this SDD cycle |

**Stale Checkpoint Reconciliation**: None required. All implementation tasks in phases 1-3 are checked and code evidence confirms completion.

## Verification Results

**From verify-report**:

```
Verdict: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING, 2 SUGGESTION)
Test suite: 15 files, 114 tests passed (per launch prompt final-state facts, correcting verify-report's 113)
Build: ✓ clean
Typecheck: ✓ pass
Format: ✓ pass
Smoke pack: ✓ shitaku --help exits 0
```

**WARNING**: "Legacy directory ignored" had no covering runtime test in verify-report. **RESOLVED by apply phase**: A test was added to `test/application/journal.test.ts` before PR merge, so the suite now includes legacy-directory coverage.

**SUGGESTION 1**: Add test seeding `~/.claude/.dotagent/manifest.json` — **RESOLVED** in apply phase.

**SUGGESTION 2**: After archive, re-run `rg -i dotagent -g '!openspec/changes/archive/**'` — **VERIFIED**: No matches found. Live specs contain intentional references only (legacy behavior documentation in MODIFIED sections, test scenarios).

## Merge Verification

**Delta Spec Composition**:
- module-resolution: Merged successfully (1 ADDED, 1 MODIFIED)
- install-safety: Merged successfully (1 ADDED, 2 MODIFIED)
- mcp-install: Merged successfully (1 MODIFIED)
- git-hooks: Merged successfully (1 MODIFIED)

**Formatted**: All merged specs passed `npx prettier --write`.

**Structural Verification**: 
- Archive source removed: ✓
- Archive destination created: ✓
- Diff verification: ✓ (empty diff on archive-report-additive comparison)
- No stale mentions in live openspec: ✓

## Implementation Evidence

**Code Changes**: Per apply-progress and design documents:
- `src/` (4 files): State dir, temp suffix, CLI name, reason string
- `test/` (6 files + 1 new): Path assertions, test titles, HOME prefix, new guard test
- `scripts/smoke-pack.mjs`: Derives bin/name from package.json
- `package.json`: Name, bin, repository fields
- `package-lock.json`: Regenerated
- `README.md`, `openspec/config.yaml`: Renamed

**Repository State** (per launch prompt):
- PR #30 merged to main (commit fc70b5d, implementation fc6a889a)
- GitHub repository renamed to JSisques/shitaku
- Remote URL updated to https://github.com/JSisques/shitaku

## Known Limitations and Deferred Work

**Phase 4 (Engram Project Migration)**: INTENTIONALLY OPEN

Per the launch prompt and design document, the Engram project migration is a separate workstream and is NOT part of this SDD cycle. The project key in Engram will remain `dotagent` until the Engram migration is run. This includes:
- Rescuing observations to the new `shitaku` project
- Migrating sessions and prompts
- Verifying `mem_current_project` shows `shitaku`

**Recommendation**: Schedule the Engram migration as a separate follow-up task after this archive closes. The existing `dotagent` Engram data will remain accessible and intact.

## Compliance

✓ All delta specs merged into main specifications  
✓ No untracked implementation tasks remain checked  
✓ Archive folder created with correct date prefix  
✓ Source removed from active changes  
✓ All artifacts present in archive  
✓ Verification warnings addressed  
✓ No critical issues blocking archive  
✓ Formatted per project conventions  

## Closure

The `rename-to-shitaku` SDD cycle is **CLOSED**. The change has been:
- Fully implemented and tested
- Verified with 114 tests passing
- All delta specs merged into main specifications
- Archived with complete audit trail

The next phase (Engram migration) is a separate workstream to be scheduled independently.

---

**Archived on**: 2026-10-02 at archive time  
**Archive Path**: `openspec/changes/archive/2026-10-02-rename-to-shitaku/`  
**Report Generated by**: sdd-archive executor (Haiku)
