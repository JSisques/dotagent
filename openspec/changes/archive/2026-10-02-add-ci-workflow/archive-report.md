# Archive Report: Add PR CI Workflow

**Change**: add-ci-workflow  
**Date archived**: 2026-10-02  
**Archived to**: `openspec/changes/archive/2026-10-02-add-ci-workflow/`  
**Spec synced to**: `openspec/specs/ci-workflow/spec.md`

## Artifact Lineage (Engram Observation IDs)

All SDD artifacts retrieved from Engram for this change:

| Artifact | Observation ID | Status |
| --- | --- | --- |
| Proposal | 1082 | ✓ Complete |
| Specification | 1083 | ✓ Complete |
| Design | 1084 | ✓ Complete |
| Tasks | 1085 | ✓ Complete (9/9) |
| Apply-progress | 1086 | ✓ Complete |
| Verify-report | 1087 | ✓ PASS WITH WARNINGS |

## Final State Summary

### Implementation
- **Status**: COMPLETE
- **Tasks completed**: 9/9 (1.1, 2.1, 2.2, 3.1-3.5, 4.1)
- **Tasks pending**: 2 manual post-merge items (M.1, M.2) — out of scope for apply
- **Commits on branch**: 2
  - `06e3f63` — "ci: add pull request validation workflow"
  - `2801a7d` — "docs: add add-ci-workflow SDD artifacts"
- **Branches**: `ci/add-pr-workflow` (not pushed; awaiting orchestrator to handle merge/PR)

### Verification
- **Verdict**: PASS WITH WARNINGS
- **Critical issues**: 0
- **Warnings**: 1
  - **WARNING**: 6 verification scenarios are runtime-dependent and only confirmable after the first PR run (PR trigger, docs-only PR, cancel, single check, lockfile drift, failing gate). See Verification Details below.
- **Suggestions**: 1
  - Current branch includes earlier `add-eslint` commits in `main..HEAD`; this is expected per the change history.

### Verification Details

From `verify-report` (observation 1087):

- **Static verification PASS**: actionlint exit 0; all six gate scripts locally verified exit 0; 8 requirements/12 scenarios compliant statically; commits conventional; action majors confirmed latest.
- **Action majors verified**: checkout@v7.0.1, setup-node@v7.0.0, pnpm/action-setup@v6.1.0 (per apply-progress deviation section). Design.md YAML was updated to reflect actual majors used.
- **Note**: `gentle-ai sdd-verify-validate` command was unavailable in the installed CLI; verify-report.md was constructed by hand-written YAML envelope with final verdict PASS WITH WARNINGS.

### Specification Sync

- **Delta spec**: `openspec/changes/add-ci-workflow/specs/ci-workflow/spec.md` (new full spec, not a delta)
- **Target location**: `openspec/specs/ci-workflow/spec.md` (newly created)
- **Requirement count**: 8 requirements, 12 test scenarios
- **Spec promotion**: NEW capability `ci-workflow` added to main specification tree
- **Verification**: Mechanically copied and diff-verified (empty diff confirms byte-identity)

### Archive Contents

✓ proposal.md — Issue #26, scope, risks, rollback plan  
✓ exploration.md — Initial analysis and decision framing  
✓ specs/ci-workflow/spec.md — 8 requirements, 12 scenarios  
✓ design.md — Technical approach, decisions, step order  
✓ tasks.md — 9/9 tasks complete (M.1/M.2 manual post-merge)  
✓ verify-report.md — PASS WITH WARNINGS (0 CRITICAL, 1 WARNING)  
✓ archive-report.md — This file

### Open Items (By Design)

These manual items are out of scope for SDD apply/verify/archive and are tracked separately:

- **M.1**: Open the first PR; confirm one check named `ci`, all steps green, token `contents: read`. Covers PR triggers, superseded run cancellation, single stable check.
- **M.2**: Optionally add `ci` as a required check in branch protection after the first green run.

These require a live PR run against the target repository and are handled by the orchestrator's merge/PR workflow, not the SDD cycle.

### Rollback

If needed, the change can be fully reversed:

1. Remove the required check `ci` from branch protection (if added per M.2)
2. Revert or delete `.github/workflows/ci.yml`
3. Remove the `.github/` directory if no other workflows exist

No spec rollback needed — the `ci-workflow` spec is additive and has no dependent specs.

## Compliance Notes

### Task Completion Gate
✓ Passed: All 9 implementation tasks marked complete in persisted tasks artifact  
✓ Manual post-merge items (M.1/M.2) correctly left unchecked as out-of-scope

### Mechanical Archive Operations
✓ Spec synced mechanically with shell `cp` (no model Read/Write)  
✓ Change folder moved mechanically with `git mv` and verified with `diff -r` (empty diff)  
✓ No truncation or alteration detected  
✓ Prettier run on synced spec: unchanged (already formatted)  
✓ Format check (`pnpm run format:check`) passes

### Artifact Store (Hybrid Mode)
✓ Engram: All 6 artifacts retrieved and recorded (observation IDs in lineage table above)  
✓ OpenSpec: Change folder moved to archive; spec promoted to main tree  
✓ Archive report persisted to Engram topic `sdd/add-ci-workflow/archive-report`

## Warnings and Decisions

### Warning: Runtime Verification Deferred
The verify phase PASS WITH WARNINGS verdict contains 6 scenarios that require a live PR run to validate fully:

1. PR to main triggers the workflow
2. Docs-only PR still runs
3. Superseded run is cancelled
4. Clean PR passes all gates
5. Lockfile drift fails
6. Failing gate fails the job

These are declarative YAML properties that actionlint and local gate execution cannot fully verify without GitHub Actions runtime. Confirm these scenarios in M.1 (first PR run) before considering the change production-ready.

### Note: Design.md Updated at Apply Time
Per apply-progress (observation 1086), the design.md file was updated during implementation to reflect verified action majors:

- Original: checkout@v6, setup-node@v6, pnpm/action-setup@v4
- Verified/Used: checkout@v7, setup-node@v7, pnpm/action-setup@v6

This is an acceptable deviation within apply scope (action majors verification) and the design reflects the final deployed state.

### Note: Verify-Report YAML Envelope
The verify-report.md was constructed with a hand-written YAML envelope because `gentle-ai sdd-verify-validate` is not in the installed CLI (per verify-report observation 1087). The verdict PASS WITH WARNINGS and associated metadata (8 requirements verified, 12 scenarios evaluated, 0 CRITICAL, 1 WARNING, 1 SUGGESTION) are valid and accurately reflect the verification outcome.

## SDD Cycle Status

✅ **COMPLETE**: Change has been fully planned (proposal/spec/design), implemented (tasks 1.1-4.1), verified (PASS WITH WARNINGS, 0 CRITICAL), and archived. Spec has been promoted to main tree. Archive folder contains complete audit trail. Manual M.1/M.2 remain out-of-scope pending first PR merge.

The `ci-workflow` capability is now part of the specification repository. Ready for the orchestrator to handle PR/merge workflow for branch `ci/add-pr-workflow`.
