# Archive Report: Add installable skills to the catalog (issue #15)

**Status**: CLOSED — Change fully archived  
**Date**: 2026-10-02  
**Change**: add-skills-catalog  
**Artifact Store**: hybrid (OpenSpec + Engram)  
**Verify Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 9 SUGGESTION, all non-blocking)

---

## Executive Summary

The add-skills-catalog change delivers installable catalog skills (SKILL.md bundles in directories) alongside existing MCP installs. Four merged PRs (#36-#39) implement:

1. **Slice 1** (PR #36): Catalog schema with skills; validation; frontmatter parsing; tree hashing; profile extends with skills
2. **Slice 2** (PR #37): Write-side file system ops; skill plan classification; manifest extension for skills
3. **Slice 3** (PR #38): Apply/undo for skills with rollback, atomic file operations, and created-directory tracking
4. **Slice 4** (PR #39): CLI flags `--skills`, interactive selection, README, and final verification

**All 26 tasks completed** (S1: 10, S2: 6, S3: 5, S4: 5). **All 5 acceptance criteria MET** with executed evidence including real built CLI runs. **277 tests passing**. **0 CRITICAL issues**. Issue #15 closed by PR #39 after the stack landed on main.

---

## Archive Actions

### Step 1: Spec Merge

Applied native `gentle-ai sdd-archive-compose` to merge delta specs into main specs. Stripped "(Previously: ...)" delta-only markers for plain current-state readability.

| Domain | Action | Details | Before/After Requirements |
|--------|--------|---------|---------------------------|
| catalog | MODIFIED | 3 existing requirements updated (Catalog layout and schema, Item validation, Profile extends); 2 new requirements added (Source guards and limits, Bundled example skill) | 4 → 6 requirements |
| mcp-install | MODIFIED | 1 requirement replaced entirely (Init flow: added skills support, scope independence, at-least-one-kind rule) | 4 → 5 requirements |
| install-safety | MODIFIED + ADDED | 2 requirements updated (Manifest: added kind, tree hash, createdDirs; Undo: added skill handling); 1 new requirement added (Multi-file write failure) | 6 → 9 requirements |
| **skills-install** | **NEW** | Full capability spec copied (6 requirements covering skill scope targets, classification, conflict handling, force replace, selection, undo) | — → 6 requirements |

**Compose Commands**:
```bash
gentle-ai sdd-archive-compose --canonical openspec/specs/catalog/spec.md --delta openspec/changes/add-skills-catalog/specs/catalog/spec.md
gentle-ai sdd-archive-compose --canonical openspec/specs/mcp-install/spec.md --delta openspec/changes/add-skills-catalog/specs/mcp-install/spec.md
gentle-ai sdd-archive-compose --canonical openspec/specs/install-safety/spec.md --delta openspec/changes/add-skills-catalog/specs/install-safety/spec.md
# skills-install: new capability, copied mechanically (no main spec to merge)
```

**Formatting**: Applied `pnpm exec prettier --write` to all modified specs. `pnpm run format:check` passed.

### Step 2: Archive Folder Move

**Source**: `openspec/changes/add-skills-catalog`  
**Destination**: `openspec/changes/archive/2026-10-02-add-skills-catalog`  
**Method**: `git mv` (tracked by git)  
**Verification**: `diff -r` confirms byte-identical transfer (no differences, no truncation)

Archive contains:
- `proposal.md` ✅
- `design.md` ✅
- `specs/` (catalog, mcp-install, install-safety, skills-install) ✅
- `tasks.md` (26 tasks, all complete) ✅
- `verify-report.md` (4 slices, final verdict documented) ✅

Source directory successfully removed; no residual state.

---

## Final State Summary

### Implementation Status

**All work complete and merged to main branch**:

- **PR #36** (feat/skills-catalog-1-catalog): 10/10 tasks, catalog schema + read side
- **PR #37** (feat/skills-catalog-2-write): 6/6 tasks, write-side + plan + manifest extension
- **PR #38** (feat/skills-catalog-3-apply-undo): 5/5 tasks, apply + undo + rollback
- **PR #39** (feat/skills-catalog-4-cli): 5/5 tasks, CLI + README + final verification
- **Total**: 26/26 tasks ✓

### Test Coverage

- **Unit Tests**: 277/277 passing (20 test files)
  - Catalog: 173 tests (slice 1)
  - Manifest & plan: 221 tests (slices 1+2)
  - Apply/undo: 254 tests (slices 1+2+3)
  - Final: 277 tests (all slices)
- **Integration**: Real CLI built and tested (temp HOME, scripted I/O, exit codes verified)
- **Architecture**: `test/architecture.test.ts` unchanged, green
- **Type checking**: `pnpm run typecheck` exit 0
- **Linting**: `pnpm run lint` exit 0
- **Formatting**: `pnpm run format:check` exit 0
- **Build**: `pnpm run build`, `pnpm run smoke:pack` exit 0

### Acceptance Criteria Met

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Catalog schema supports skills and is validated on load | schema.test.ts, skill.test.ts, folder-source.test.ts, bundled-catalog.test.ts; real CLI loaded bundled `example-skill` | ✓ MET |
| 2 | `init` installs selected skill and `undo` reverts it | Real CLI: install→undo to empty; forced replace + undo restore byte-identical; mixed MCP+skill undo | ✓ MET |
| 3 | Existing user skills never overwritten silently | Conflict in plan, exit 2, unchanged; `--force` only after backup; interactive ask per skill | ✓ MET |
| 4 | Tests cover plan, apply, undo for skills; typecheck/build/vitest pass | 277/277 tests, all manual checks pass | ✓ MET |
| 5 | README documents skills kind | README "Skills" section: flags, scopes, safety, downgrade warning, trust note | ✓ MET |

### Verification Verdict

**Source**: `verify-report.md` (complete 4-slice report in archive)

- **Slice 1 (Catalog)**: PASS WITH WARNINGS (W1-W5, S1-S3)
- **Slice 2 (Write)**: PASS WITH WARNINGS (W6-W7, S-a through S-e)
- **Slice 3 (Apply/Undo)**: PASS WITH WARNINGS (W-a through W-d, S-f through S-j)
- **Slice 4 (CLI) + Final**: PASS WITH WARNINGS (W-e, W-f, S-k through S-p)

**Final Whole-Change Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 9 SUGGESTION)

Critical issues: **none**  
Blocking warnings: **none** (all are documentation, configuration, or edge-case suggestions)

### Known Limitations and Follow-ups (Non-blocking)

Carried open items from verification (non-blocking, acceptable per review):

1. **S1**: Frontmatter parser rejects block scalars/lists (`description: >`, multi-line keys). README documents "single-line name and description"; invalid skills are skipped with warning.

2. **S2**: Duplicate frontmatter keys silently resolved (last wins). No safety impact; name must still match directory.

3. **S-a**: `writeBytes` respects process umask; files written 0644 under umask 022. Documented as a known limit.

4. **S-b**: Tree hash ignores file mode; mode-only differences are `skip`. Not restored on undo/replace.

5. **S-h**: MCP-side directories created by `writeAtomic` are not tracked in `createdDirs` (skills only). Pre-existing behavior.

6. **S-i**: `exists()` follows symlinks; dangling links count as missing. Write path uses `O_NOFOLLOW` guards; symlinked targets exit 1.

7. **S-k**: `--scope` given twice silently takes the last value (commander default). Issue decision specifies single scope.

8. **S-l**: `init --skills x` without `--scope` and no TTY hangs on scope prompt (pre-existing for `--mcps` mode).

9. **S-m**: `ClackPrompter` has no unit test (thin wrapper, only exercised by fake prompter).

No regressions. No security issues. All user-facing decisions recorded in apply-progress and verify-report (e.g., undo behavior with foreign-only created dirs, symlinked file handling on undo, failed-apply backup retention). The change is production-ready and shipped.

---

## Spec Merge Details

### Catalog (6 requirements)

**MODIFIED**:
- "Catalog layout and schema": now specifies `skills/` layout with `SKILL.md` frontmatter (name, description), optional `items.skills` array (default `[]`), reserved dirs (instructions, hooks, now also skills if reserved)
- "Item validation": widened to cover skills; invalid skills skipped with reason, not installable
- "Profile extends": profiles now support `skills` field (default `[]) and merge de-duplicated skill names

**ADDED**:
- "Source guards and limits": traversal rejection, symlink rejection, per-file and per-skill size/count limits
- "Bundled example skill": catalog includes one minimal valid skill in `items.skills`

### MCP Install (5 requirements)

**MODIFIED**:
- "Init flow": entirely replaced with skills support. Now: `--mcps` and `--skills` both optional, at-least-one-kind rule, independent scope applies to both, interactive prompt only when catalog has skills, non-interactive accepts both flags, program name `shitaku` (was `dotagent-cli`), exit non-zero if neither kind selected

Other 4 requirements (Scope targets, Merge preserving unknown keys, Existing entries, Required env) remain unchanged.

### Install Safety (9 requirements)

**MODIFIED**:
- "Manifest": now records `kind` (mcp/skill), tree hash per skill, `createdDirs` array, per-file hashes. One install record covers both kinds. Manifest version stable.
- "Undo": now reverts skills. Refuses for changed entries without `--force`. For skills: removes only shitaku-created files/dirs, refuses on drift or user files, skips created dirs that are now empty or hold only foreign files.

**ADDED**:
- "Multi-file write failure": skill writes atomic (temp→rename); on failure, removes created files/dirs, restores replaced-dir backups, records no manifest entry. Backups retained for manual recovery (no auto-cleanup).

### Skills Install (6 requirements, NEW)

Full spec for the new skills capability:

1. "Skill scope targets": user scope `~/.claude/skills/<name>/`, project scope `<cwd>/.claude/skills/<name>/`, all files byte-identical
2. "Per-skill classification": tree hash comparison yields create/skip/update/conflict
3. "Conflict handling": plan lists conflicts; non-interactive+conflict+no-force exits 2; interactive asks per skill
4. "Force replace": backs up conflicting dir, replaces as whole (extra files deleted), restorable by undo
5. "Skill selection": `--skills <a,b>` selects by name; unknown exits 1 with name; honors `--dry-run`
6. "Skill undo": reverts created skills (remove files/dirs shitaku wrote, restore replaced dirs from backup), refuses on drift without `--force`

---

## Artifacts

### Persisted to OpenSpec Filesystem

- `openspec/specs/catalog/spec.md`: merged + delta markers stripped
- `openspec/specs/mcp-install/spec.md`: merged + delta markers stripped
- `openspec/specs/install-safety/spec.md`: merged + delta markers stripped
- `openspec/specs/skills-install/spec.md`: new capability, copied mechanically
- `openspec/changes/archive/2026-10-02-add-skills-catalog/`: folder moved, all artifacts preserved

### Persisted to Engram (Hybrid Mode)

- Topic key: `sdd/add-skills-catalog/archive-report`
- Type: `architecture`
- Content: Full archive report (this document)

---

## Quality Gates Passed

✅ Task completion gate: 26/26 tasks checked  
✅ Mechanical copy verification: diff -r empty (no truncation)  
✅ Format check: `pnpm run format:check` exit 0  
✅ Architecture test: unchanged, green  
✅ Type safety: `pnpm run typecheck` exit 0  
✅ Lint: `pnpm run lint` exit 0  
✅ Tests: 277/277 passing  
✅ Build: `pnpm run build` exit 0  
✅ No CRITICAL verification issues  

---

## SDD Cycle Complete

The change has been fully:
- **Proposed** (explored, decided scope and approach)
- **Specified** (open specs written for catalog, mcp-install, install-safety, skills-install)
- **Designed** (architecture documented: domain, ports, adapters; Hexagonal purity maintained)
- **Tasked** (26 work units per slice, Strict TDD delivery)
- **Applied** (4 PRs merged to main, all code green)
- **Verified** (comprehensive test suite, real CLI tested, acceptance criteria met, warnings non-blocking)
- **Archived** (delta specs merged into main specs, change folder moved, audit trail complete)

Ready for the next change. No follow-up SDD required; the 9 non-blocking suggestions are acceptable as documented.
