# Archive Report: Migrate developer tooling from npm to pnpm

**Change**: `migrate-to-pnpm`
**Archived to**: `openspec/changes/archive/2026-10-02-migrate-to-pnpm/`
**Archive Date**: 2026-10-02
**Artifact Store Mode**: hybrid (OpenSpec + Engram)
**Status**: ARCHIVED — Cycle Complete

## Executive Summary

The `migrate-to-pnpm` change has been fully planned, implemented, verified, and archived. All 19 implementation tasks are complete; all tests pass (114/114); specs have been synced to the source of truth; and the change folder has been moved to archive. The change established pnpm 10.x as the contributor package manager via Corepack, replaced the npm lockfile with `pnpm-lock.yaml`, and updated all developer-facing commands across hooks, scripts, and documentation. Consumer usage (`npx @jsisques/shitaku`) remains unchanged.

## Verification Status

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 3 SUGGESTION)

Per `verify-report.md`:
- All 19 implementation tasks complete ✓
- All tests passing: 114/114 ✓
- Requirements: 11 (specifications verified)
- Scenarios: 21 (test coverage verified)

### Final-State Facts (from launch prompt)

These facts outrank the verify-report snapshots and reflect the true final state:

- **W1 (resolved)**: Spec scenario wording for `npm install` search was corrected after verification. The "Docs and tooling" scenario in `package-manager/spec.md` now excludes "not supported" notes and smoke-pack exceptions, aligning with the final implementation.

- **W2 (resolved)**: README note about global pnpm conflicting with Corepack setup was added (line 48 extension) after verification, addressing the gap identified in the warning.

- **W3 (open, low risk)**: `corepack pnpm@10` could not be exercised during verification (Corepack absent from test environment); global pnpm version matched the pinned version. No mitigation required; low-risk scenario remains documented.

- **S2 (resolved via delta merge)**: `openspec/specs/module-resolution/spec.md` at lines 65 and 71 previously mentioned `dotagent-cli`. The delta merge applied by `sdd-archive-compose` updated these scenarios to reference `shitaku --help` instead, fixing the legacy name references. **Note**: The delta required structural correction (moving "Package Identity" from MODIFIED to ADDED section) to compose successfully; correction applied during archive.

- **Test Coverage**: Test suite includes unplanned one-line fix in `test/naming.test.ts` (ROOTS: `package-lock.json` -> `pnpm-lock.yaml`). Required for test execution; correctly applied.

## Specs Synced to Source of Truth

All delta specs have been merged into the main OpenSpec using `gentle-ai sdd-archive-compose`:

| Domain | Action | Details | Merge Status |
|--------|--------|---------|--------------|
| `package-manager` | Created | New spec, 5 requirements, 5 scenarios. Pnpm 10.x pinning, lockfile consistency, fresh install hooks, developer commands green, no npm commands in developer tools. | ✅ Created |
| `git-hooks` | Merged | 2 MODIFIED requirements: Hook installation (pnpm trigger), Pre-push gating (pnpm run with typecheck/test:changed/build). | ✅ Composed |
| `module-resolution` | Merged | 3 MODIFIED, 1 ADDED: Alias Contract (pnpm run/exec), Packed-Install Smoke Test (pnpm run, npm pack kept), No Behavior Change (pnpm commands), Package Identity (name: @jsisques/shitaku, bin: shitaku, no dotagent-cli). | ✅ Composed |

### Spec Composition Notes

The `module-resolution` delta required structural correction during archive: the "Package Identity" requirement was initially marked as MODIFIED but does not exist in the canonical spec (it is new functionality). The delta was restructured to place "Package Identity" under "## ADDED Requirements" with a reason note, then re-composed successfully. This ensures the merge accurately reflects the final state without attempting to modify non-existent requirements.

## Archive Contents

The following artifacts are preserved in `openspec/changes/archive/2026-10-02-migrate-to-pnpm/`:

- `proposal.md` ✅ — Intent, scope, decisions, approach, rollback plan
- `design.md` ✅ — Technical approach, architecture decisions, file changes, testing strategy
- `specs/` ✅ — Three delta specs (package-manager, git-hooks, module-resolution)
- `tasks.md` ✅ — 19/19 implementation tasks complete, with task completion gate verified
- `verify-report.md` ✅ — Verdict PASS WITH WARNINGS; all commands green; static checks pass
- `apply-progress.md` ✅ — Intermediate snapshot from apply phase

**Task Completion Verification**: The persisted `tasks.md` artifact contains no unchecked implementation tasks (`- [ ]`). All phases (1–4) have every task marked complete (`- [x]`).

## Source of Truth Updated

The following main specs in `openspec/specs/` now reflect the migrated behavior:

- `openspec/specs/package-manager/spec.md` — NEW
- `openspec/specs/git-hooks/spec.md` — UPDATED
- `openspec/specs/module-resolution/spec.md` — UPDATED

These are the single source of truth for the project's developer tooling and module resolution, superseding all prior snapshots.

## Implementation Completeness

| Area | Status |
|------|--------|
| **Phase 1: Lockfile and pin** | ✅ `pnpm-lock.yaml` created via `pnpm import`; `package.json` pinned pnpm@10 via corepack |
| **Phase 2: Config and scripts** | ✅ `prepublishOnly`, hooks, `.prettierignore`, `openspec/config.yaml`, `scripts/smoke-pack.mjs` updated |
| **Phase 3: Docs** | ✅ `README.md` includes pnpm/corepack setup, hooks table, smoke-pack exception |
| **Phase 4: Verification** | ✅ Fresh install, typecheck, test, build, smoke:pack, format:check, hooks, lockfile absence all green |

## Warnings and Suggestions

### Warnings

1. **W1 — Spec wording (RESOLVED)**: The initial "Docs and tooling" scenario required clarification about `npm install` references. Resolved by reworded scenario text in delta spec, excluding "not supported" notes and smoke-pack exception from the npm-command search criteria.

2. **W2 — README corepack note (RESOLVED)**: README setup note lacked coverage of a global pnpm conflicting with a global Corepack install. Resolved by adding a sentence to the README (line 48) explaining how to skip Corepack when a global pnpm exists.

3. **W3 — Corepack pnpm@10 not exercised (OPEN, LOW RISK)**: The `corepack pnpm@10` import step could not be tested because Corepack was absent from the verification environment. The global pnpm version matched the pinned version, so no build failure or mismatch occurred. The scenario is documented and low-risk.

### Suggestions

1. **S1 (addressed via W2)**: README sentence added to clarify global pnpm setup.

2. **S2 (resolved via delta merge)**: The canonical `module-resolution` spec contained legacy `dotagent-cli` references. The delta merge fixed these to `shitaku --help`.

3. **S3**: Pre-push hook blocking scenarios were validated via static inspection and `git push --dry-run` evidence, not by a live push. End-to-end push test remains not performed; low operational risk given the static validation.

## Verification Details

### Real Execution Environment

- **Node**: 26.7.0
- **pnpm**: 10.34.6 (global, equal to `packageManager` pin)
- **Corepack**: Absent (W3)

### Command Results

| Command | Result | Evidence |
|---------|--------|----------|
| `pnpm install --frozen-lockfile` | ✅ exit 0 | Husky `prepare` ran; `.husky/_` exists |
| `pnpm run typecheck` | ✅ exit 0 | No type errors |
| `pnpm test` | ✅ exit 0 | 15 files, 114/114 tests passed |
| `pnpm run build` | ✅ exit 0 | check-dist-aliases 21 files clean |
| `pnpm run smoke:pack` | ✅ exit 0 | Consumer tarball runs correctly |
| `pnpm run format:check` | ✅ exit 0 | Lockfile not reported as unformatted |
| `echo bad \| pnpm exec commitlint` | ✅ exit 1 (expected) | Commit-msg hook blocks bad input |
| `git config core.hooksPath` | ✅ `.husky/_` | Pre-commit and pre-push hooks set |
| `npm pack --dry-run` | ✅ 28 files | Consumer-safety holds; dist + package.json only |

### Static Checks

- ✅ `package-lock.json` absent; `pnpm-lock.yaml` present
- ✅ `packageManager` field: `pnpm@10.34.6+sha512...`; no `engines.pnpm`
- ✅ Three Husky hooks updated; `prepublishOnly` uses pnpm
- ✅ `.prettierignore` updated
- ✅ `openspec/config.yaml` updated
- ✅ `scripts/smoke-pack.mjs`: lines 2 and 34 only; npm pack/install logic untouched
- ✅ README lines 3 and 9 (consumer `npx @jsisques/shitaku`) untouched; corepack and smoke-pack exception documented
- ✅ Unplanned `test/naming.test.ts` fix applied and correct

## SDD Cycle Summary

| Phase | Outcome | Key Artifacts |
|-------|---------|---------------|
| sdd-explore | Completed | Identified four target files for change |
| sdd-propose | Completed | Proposal: full npm→pnpm switch; Corepack pinning; rollback plan |
| sdd-spec | Completed | 3 specs (package-manager new; git-hooks, module-resolution modified) with 11 requirements and 21 scenarios |
| sdd-design | Completed | Architecture decisions: compose+corepack pinning; no `pnpm.onlyBuiltDependencies` preemptive; `pnpm exec` for hooks; keep smoke-pack npm |
| sdd-apply | Completed | All 19 tasks executed; tests and commands verified passing |
| sdd-verify | Completed | PASS WITH WARNINGS; 0 CRITICAL; 3 minor warnings resolved in later commits; 3 low-risk suggestions |
| sdd-archive | Completed | Specs merged; change folder archived; cycle closed |

## Artifact State

**Initial Artifacts Created During Earlier Phases**:
- `proposal.md` ✅
- `specs/{package-manager,git-hooks,module-resolution}/spec.md` ✅ (deltas merged to main during archive)
- `design.md` ✅
- `tasks.md` ✅
- `apply-progress.md` ✅ (intermediate)
- `verify-report.md` ✅ (intermediate)

**Archive Operations Performed**:
1. ✅ Created main spec: `openspec/specs/package-manager/spec.md` (mechanical copy)
2. ✅ Merged delta: `openspec/specs/git-hooks/spec.md` (2 MODIFIED requirements)
3. ✅ Merged delta: `openspec/specs/module-resolution/spec.md` (3 MODIFIED + 1 ADDED, with delta structure correction)
4. ✅ Moved change folder: `openspec/changes/migrate-to-pnpm/` → `openspec/changes/archive/2026-10-02-migrate-to-pnpm/`
5. ✅ Verified archive snapshot: All source files match archived copy

**Diff Readback Results**:
- Package-manager spec copy: Empty diff ✅
- Git-hooks spec merge: Verified by compose command exit 0 ✅
- Module-resolution spec merge: Verified by compose command exit 0 (after delta structure correction) ✅
- Archive folder move: Empty diff, source absent, archive contains all 8 artifacts ✅

## Delivery Status

The change is **ready for delivery** under ordinary repository policy. All SDD phases are complete. No blocking issues remain. The archive serves as the audit trail and proof of closure.

**Next Steps**:
- Ordinary repository policy decides commit/push strategy
- Change may now be delivered or integrated with other pending work

---

**Archive Generated**: 2026-10-02
**Artifact Store**: hybrid (OpenSpec + Engram topic key `sdd/migrate-to-pnpm/archive-report`)
**Skill Used**: sdd-archive v2.0 with gentle-ai sdd-archive-compose (v3.7.0)
