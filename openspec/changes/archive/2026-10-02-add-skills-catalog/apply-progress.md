# Apply progress: add-skills-catalog

## Slice 1 (tasks 1.1-1.10): DONE. Mode: Strict TDD. Branch: feat/skills-catalog-1-read-side

Completed: 1.1-1.10. Slice 2 (2.1-2.6) is DONE, see below. Remaining: slices 3-4 (3.1-4.5).

### TDD Cycle Evidence

| Task | Test file                                      | Layer                  | Safety net  | RED                                                                                  | GREEN        | Triangulate                                                           | Refactor    |
| ---- | ---------------------------------------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------- | ----------- |
| 1.1  | test/domain/catalog/skill.test.ts              | Unit                   | N/A (new)   | module missing                                                                       | 9/9          | Skipped: constants only                                               | None needed |
| 1.2  | test/domain/catalog/schema.test.ts             | Unit                   | 11/11       | 3 failed                                                                             | 14/14        | absent, valid, traversal, uppercase                                   | None        |
| 1.3  | test/domain/catalog/skill.test.ts              | Unit                   | N/A (new)   | module missing                                                                       | 9/9          | 8 behaviors                                                           | None        |
| 1.4  | test/domain/hash.test.ts                       | Unit                   | N/A (new)   | 3 failed                                                                             | 6/6          | order, null, content/path, formula                                    | None        |
| 1.5  | test/domain/catalog/profile.test.ts            | Unit                   | 6/6         | 4 failed                                                                             | 8/8          | dedupe, extends, cycle, unknown skill/mcp                             | None        |
| 1.6  | (types only, covered by typecheck + 1.7)       | n/a                    | n/a         | n/a                                                                                  | typecheck ok | n/a                                                                   | n/a         |
| 1.7  | test/adapters/fs/walk.test.ts, node-fs.test.ts | Integration (tmp dirs) | 5/5 node-fs | walk: module missing; node-fs RED not run separately (impl written right after test) | 27/27        | symlink file/dir/root, backslash, size, count, depth, total, realpath | None        |
| 1.8  | test/adapters/catalog/folder-source.test.ts    | Integration            | 5/5         | 9 failed                                                                             | 13/13        | valid+binary, invalid, symlink file/dir, profile skills               | None        |
| 1.9  | test/adapters/catalog/folder-source.test.ts    | Integration            | same        | same run                                                                             | same         | listed-missing, unlisted                                              | None        |
| 1.10 | test/adapters/catalog/bundled-catalog.test.ts  | Integration            | 1/1         | failed (signature)                                                                   | 173/173 full | n/a                                                                   | None        |

### Work Unit Evidence

- Focused: `pnpm vitest run test/domain test/adapters` -> pass. Full `pnpm test`: 19 files, 173 tests pass (baseline 122).
- Runtime harness: bundled catalog load in bundled-catalog.test.ts (real FS).
- Rollback: revert the slice-1 PR (additive; resolveProfile signature change is internal to folder-source and tests).

### Verification

`pnpm run typecheck` ok, `pnpm run lint` ok, `prettier --check src test catalog` ok. `pnpm run format:check` fails only on pre-existing untracked openspec/changes/add-skills-catalog/*.md artifacts (not touched).

### Deviations

- UnsafeTreeError class lives in src/ports/file-system.ts (ports are otherwise types-only).
- SkillNameSchema lives in domain/catalog/skill.ts (avoids a schema<->skill import cycle).
- Profile gains `skills` and the catalog `Catalog.skills`; resolveProfile/validateProfiles take a 4th/3rd `skillNames` param.
- Slice size: ~660 added lines (284 modified + 377 new), over the 400 budget; tests are about 60%.

## Remediation of verify warnings W1-W4 (slice 1)

| Warning | Fix                                                                                                                                                                                              | Test (RED then GREEN)                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1      | `SkillNameSchema` regex gets a custom error naming the input (`invalid skill name '../evil'`); catalog still fails as a whole (spec: "fails naming ../evil")                                     | schema.test.ts now asserts the message contains `../evil`; folder-source.test.ts "fails the catalog naming a skill entry that could traverse paths"      |
| W2      | `SkillIssue` carries optional `file`; frontmatter/description issues are reported against `skills/<name>/SKILL.md` (loader joins it). Name mismatch and missing SKILL.md stay on `skills/<name>` | folder-source.test.ts "reports a missing description against skills/<name>/SKILL.md"; existing "skips an invalid skill" updated to `skills/bad/SKILL.md` |
| W3      | Test-only: loader-level over-limit tests (file size, file count, depth, total size), each rejects `skills/demo` naming the limit and keeps the valid skill                                       | folder-source.test.ts `it.each` (passed immediately, impl already correct)                                                                               |
| W4      | Unlisted scan uses `readdir(withFileTypes)` and flags directories only                                                                                                                           | folder-source.test.ts "ignores non-directory entries in skills/ but flags unlisted directories"                                                          |

Verification: `pnpm test` 19 files, 180 tests pass (was 173); typecheck, lint, `prettier --check src test catalog` ok; test/architecture.test.ts unchanged.
Still open: W5 (TOCTOU lstat vs readFile), S1 (block scalars/lists in frontmatter), S2 (duplicate keys last wins), S3 (slice size).

## Slice 2 (tasks 2.1-2.6): DONE. Mode: Strict TDD. Branch: feat/skills-catalog-2-write-side (stacked on slice 1, PR #36)

Completed: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6. Remaining: slices 3-4 (3.1-4.5). Not committed; changes are in the working tree.

### TDD Cycle Evidence

| Task | Test file                                | Layer       | Safety net | RED                                  | GREEN                  | Triangulate                                                                                           | Refactor                                             |
| ---- | ---------------------------------------- | ----------- | ---------- | ------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2.1  | test/adapters/fs/node-fs.test.ts         | Integration | 12/12      | 6 failed (not a function)            | 39/39 with 2.2         | bytes+mode+no temp, replace, failed rename, exists x3, removeDir x3                                   | writeAtomic and writeBytes share `writeViaTemp`      |
| 2.2  | test/adapters/claude-code/target.test.ts | Unit        | 4/4        | 2 failed                             | same run               | user and project scope                                                                                | None                                                 |
| 2.3  | test/domain/manifest.test.ts             | Unit        | 6/6        | 7 failed                             | 13/13                  | old manifest, skill item, null hash, missing root, ownership x4, mcp ignore                           | deriveOwnership now only records mcp items           |
| 2.4  | test/application/undo-install.test.ts    | Integration | 8/8        | none: passed on first run (see note) | 10/10                  | absent file not drift, restore from backup, reappeared file refused exit 3                            | None                                                 |
| 2.5  | test/domain/plan/skill-plan.test.ts      | Unit        | N/A (new)  | module missing                       | 21/21 with plan folder | create, skip, update, owned-modified, unowned, force, force-skip, removed                             | None                                                 |
| 2.6  | test/application/init-mcps.test.ts       | Integration | 17/17      | 10 failed                            | 27/27                  | user/project roots, combined, skip, update+removed, conflicts, force, unknown, symlink root and inner | planMcps extracted from planInit, behavior unchanged |

Note 2.4: the minimal null-safe path needed no production change. `hashOf` already returns null for an absent file, so `hashOf(...) !== file.afterHash` handles a nullable `afterHash`, and the widened types compile. The three tests lock that behavior in (no RED possible). Compile breakage from the widening was only in `init-mcps.ts` and test helpers (missing `createdDirs`).

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/domain test/adapters test/application/init-mcps.test.ts` -> pass; full `pnpm test`: 20 files, 221 tests pass (was 19 files, 180)                            |
| Runtime harness      | `planInit` against real temp-dir FS (NodeFileSystem) with a stub catalog source and the bundled catalog; symlinked skill root and inner symlink fail planning even with `--force` |
| Rollback boundary    | Revert the slice-2 PR: ports/adapters additions, `skill-plan.ts`, manifest widening, `planInit` skills path. Old manifests still parse; no behavior is reachable from the CLI yet |

### Verification

`pnpm test` 221/221, `pnpm run typecheck` ok, `pnpm run lint` ok, `pnpm run format:check` ok. `test/architecture.test.ts` unchanged and green.

### Deviations from design

- `planInit` returns an empty `files` list when no MCP is requested (skills only), instead of a no-item MCP file change. Needed so a skills-only run does not touch or print the MCP config.
- `InitRequest.skills` is optional (defaults to none) to keep existing MCP callers and tests unchanged.
- `planInit` tests use the real NodeFileSystem on temp dirs with a stub `CatalogSource`, not an in-memory FS (the symlink cases need a real FS).
- `deriveOwnership` (MCP, keyed by file path) now ignores skill items; skill ownership is keyed by root via `deriveSkillOwnership`.
- `skill-plan.ts` imports the `Action` type from `change-plan.ts` and `change-plan.ts` imports `SkillChange` back (type-only cycle, erased at build, lint passes).
- `applyPlan` writes `createdDirs: []` for MCP installs; skill apply is slice 3.

### Slice size

About 604 added lines (438 inserted in 13 modified files plus 166 in 2 new files), tests about 60%. Over the 400 budget, same shape as slice 1; no tests trimmed. Recommend `size:exception`.

### Carried-forward open notes (not touched)

W5 TOCTOU lstat vs readFile, S1 frontmatter block scalars/lists, S2 duplicate keys last wins. Also relevant to S3: `readPresent` in `planInit` has the same lstat-then-read gap on the target side.

## Slice 2 remediation (verify warnings W6, W7, W5; suggestions S-c, S-d)

Strict TDD. RED observed for each fix (5 failing tests with the production change reverted, then GREEN after restoring it). Tasks 2.1-2.6 stay complete; no new tasks.

| Fix                       | RED test                                                                                       | GREEN change                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W7 duplicate skills       | `plans each skill once when the request repeats a name...`                                     | `planInit` de-duplicates `req.skills` with `new Set` (first-occurrence order)                                                                                                                                                                                             |
| W6/W5 TOCTOU, target side | `refuses to read through a symlink...` (node-fs), swap and vanish tests in `planInit (skills)` | `readFileNoFollow` in `adapters/fs/walk.ts`: open with `O_NOFOLLOW`, `fstat` on the handle (regular file, size limit), re-check size after read; `NodeFileSystem.readBytes` delegates to it (symlink/special/oversized -> `UnsafeTreeError`; missing stays null per port) |
| W6 vanished file dropped  | `fails planning when a listed file vanishes before it is read`                                 | `readPresent` throws `UnsafeTreeError` instead of skipping a file whose `readBytes` is null                                                                                                                                                                               |
| W5 catalog side           | `readFileNoFollow` unit tests in `walk.test.ts`                                                | `readTree` uses `readFileNoFollow`; a file vanishing after the scan raises `UnsafeTreeError`                                                                                                                                                                              |
| S-c                       | `rejects a null afterHash on an MCP file but accepts it on a skill file`                       | manifest `FileSchema.refine`: null `afterHash` only when every item is a skill                                                                                                                                                                                            |
| S-d                       | `parses a literal manifest JSON written before skills existed`                                 | test-only (literal pre-change JSON fixture; passes without prod change)                                                                                                                                                                                                   |

Notes: O_NOFOLLOW guards the final path component only; intermediate directories are covered by the existing lstat scan and `expectedReal` check on the catalog side. The vanish/swap race is simulated by wrapping `listFiles` to mutate the tree after listing; `readTree`'s vanish branch is covered by the guard unit tests (a deterministic hook between scan and read does not exist).

Verification: `pnpm test` 20 files, 230 tests pass (was 221); typecheck, lint, format:check ok; `test/architecture.test.ts` unchanged.

Skipped: S-a, S-b, S-e. Still open: S1 frontmatter block scalars/lists, S2 duplicate keys last wins, slice over 400 lines (`size:exception`).

## Slice 3 (tasks 3.1-3.5): DONE. Mode: Strict TDD. Branch: feat/skills-catalog-3-apply-undo (stacked on slice 2, PR #37)

Completed: 3.1, 3.2, 3.3, 3.4, 3.5. Remaining: slice 4 (4.1-4.5). Not committed; changes are in the working tree.

### TDD Cycle Evidence

| Task | Test file                                                          | Layer       | Safety net | RED                                                          | GREEN                  | Triangulate                                                                                                                                | Refactor                                                                                      |
| ---- | ------------------------------------------------------------------ | ----------- | ---------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 3.1  | test/application/init-mcps.test.ts (`applyPlan (skills)`)          | Integration | 30/30      | 8 failed (30 passed)                                         | 38/38 with 3.2         | create+binary, createdDirs, SKILL.md last, update, force, skip/conflict/dry-run, mixed MCP+skill, stale                                    | None                                                                                          |
| 3.2  | same                                                               | Integration | same       | same run                                                     | 133/133 domain+app     | as 3.1                                                                                                                                     | `scope` added to SkillPlanEntry/SkillChange (RED in skill-plan.test.ts: 1 failed, then 15/15) |
| 3.3  | test/application/init-mcps.test.ts (`applyPlan rollback (skills)`) | Integration | 38/38      | 4 failed of 5 (the backup-write-failure case passed already) | 58/58 test/application | third of four writes, forced replace with last write failing, backup write failing, MCP written earlier, incomplete rollback then conflict | rollback helpers extracted (`restoreText`, `restoreBytes`, `rollback`)                        |
| 3.4  | test/application/undo-install.test.ts (`undoInstall (skills)`)     | Integration | 10/10      | 10 failed (10 passed)                                        | 20/20 with 3.5         | clean, pre-existing dir kept, extra file, modified file, --force, non-empty created dir, forced replace, update, root LIFO, dry run        | None                                                                                          |
| 3.5  | same                                                               | Integration | same       | same run                                                     | 68/68 test/application | as 3.4                                                                                                                                     | `currentHash`, `isSkillFile`, `unrecordedFiles` helpers                                       |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/application` -> 68/68 pass. Full `pnpm test`: 20 files, 254 tests pass (was 230)                                                                                                                                               |
| Runtime harness      | Real NodeFileSystem on temp dirs plus `faultyFs` (test/helpers/skills.ts), a wrapper that throws on the nth matching `writeBytes`/`writeAtomic`/`remove` and records the call order; apply then undo end to end, including forced replace and update |
| Rollback boundary    | Revert the slice-3 PR: `applyPlan`/`undoInstall` changes, `scope`/`writesSkill` in skill-plan.ts, test helper. Unreachable from the CLI until slice 4                                                                                                |

### Verification

`pnpm test` 254/254, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` all exit 0. `test/architecture.test.ts` unchanged and green.

### Behavior implemented

- applyPlan: refreshes each writable skill (re-reads with the no-follow guards, re-plans, `StaleFileError` when the action changes); computes `createdDirs` (missing ancestors, parents first) before any write; writes all backups first (MCP text, skill bytes), then MCP files, then skills (non-SKILL.md files, deletions, SKILL.md last); one Install record; manifest appended last.
- Failure: every completed write is reverted newest first (restore bytes or remove), then `createdDirs` are removed deepest first with non-recursive `removeDir`; backups stay on disk; the original error is rethrown, annotated `rollback incomplete: ...` if a revert step failed. No manifest entry on failure. This also now covers an MCP file written earlier in the same install.
- undoInstall: skill files are compared and restored as bytes (MCP config files stay text, because `readBytes` has a 1 MiB limit); unrecorded files under a skill root count as drift (exit 3, listed in `changed`); `--force` restores the recorded files and leaves unknown files, and non-empty directories are skipped; `createdDirs` pruned deepest first; LIFO also blocks on a newer non-undone install owning the same skill root.
- Orphaned skill dir after a crash: no production change needed, planInit already reports an unowned existing dir as `conflict`; locked in by the incomplete-rollback test.

### Deviations from design

- `scope` was added to `SkillPlanEntry` and `SkillChange` so apply can record the scope per file (design only had root).
- Rollback also reverts MCP files written earlier in the same install (design only described skills).
- A non-empty created directory that holds only unrelated user files (for example another skill under a freshly created `.claude/skills`) is skipped silently and undo succeeds; only user files under a skill root refuse.
- Backups of a removed or replaced file are all kept after a failed apply (design: "plus the backups on disk").
- Every file of an updated skill is rewritten and recorded (even if unchanged), so the unrecorded-file drift check never flags an unchanged recorded file.

### Slice size

About 640 added lines (594 inserted + 71 new helper, minus 44 modified), tests about 60%. Over the 400 budget; no tests trimmed. Recommend `size:exception`.

### Carried-forward open notes

S1 frontmatter block scalars/lists, S2 duplicate keys last wins, S-a umask on writeBytes, S-b mode not hashed. Undo of a skill file that is a symlink raises `UnsafeTreeError` (exit 1) rather than refusing with exit 3.

### Slice 3 remediation (verify warnings W-a, W-b, S-g, S-f partial, W-c, W-d)

Strict TDD: tests written first, RED observed (4 failed / 21 passed in `undo-install.test.ts`: both symlink tests, missing backup, tampered createdDirs; the foreign-files test already passed and is a characterization test).

- W-a: `undoInstall` drift scan now maps `UnsafeTreeError` to drift. A recorded file that is a symlink is listed in `changed`; a symlink or special file under a skill root lists the root. Both refuse with exit 3 and touch nothing.
- W-b: `assertBackupsPresent` checks every referenced backup with `fs.exists` before the first restore; a missing one throws `UndoVerifyError` ("nothing was changed"), manifest stays not-undone, files untouched, rerun gives the same error. Placed after drift/dry-run so a dry run is unchanged.
- S-g: `prunableDirs` ignores (does not refuse) any `createdDirs` entry that is not a recorded skill root, an ancestor, or a subdirectory of one, strictly inside the home or working directory. Ignoring keeps a tampered manifest from blocking undo while never touching foreign paths (`rmdir` is non-recursive anyway).
- S-f: added mixed MCP+skill undo test and a test where the MCP restore also fails during rollback (both are characterization tests, green on first run; production unchanged for them).
- W-c/W-d (docs only): design.md states that skipping a non-empty created dir is unconditional, not a `--force` behavior, plus the backups-present and createdDirs filter notes; scenarios added to `specs/skills-install/spec.md` (foreign-only created dir, symlinked file) and `specs/install-safety/spec.md` (missing backup, failed-apply backups kept on disk without manifest reference); task 3.4 updated.
- Verification: `pnpm test` 20 files, 261 tests pass (was 254); typecheck, lint, format:check exit 0; `test/architecture.test.ts` unchanged.

Still open: S-h (MCP-side dirs not tracked in createdDirs), S-i (`exists` follows symlinks), S-j / S-a (umask on writeBytes), S-b (mode not hashed), S1, S2, and all slice-1/2 open items. Next: slice 4.

## Slice 4 (tasks 4.1-4.5): DONE. Mode: Strict TDD. Branch: feat/skills-catalog-4-cli (stacked on slice 3, PR #38)

Completed: 4.1, 4.2, 4.3, 4.4, 4.5. All 26 tasks complete. Not committed; changes are in the working tree.

### TDD Cycle Evidence

| Task | Test file                         | Layer       | Safety net | RED                                                                 | GREEN               | Triangulate                                                                                                                                                                                                                                                                         | Refactor                                                    |
| ---- | --------------------------------- | ----------- | ---------- | ------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 4.1  | test/adapters/cli/program.test.ts | Integration | 24/24      | part of the 15 failed run below (conflict `kind` assertion, skills) | 39/39 with 4.3      | MCP conflict reports `kind: mcp`, skill conflict `kind: skill` with reason                                                                                                                                                                                                          | None                                                        |
| 4.2  | same                              | Integration | 24/24      | 15 failed / 24 passed (39) before any production change             | 39/39               | help lists `--skills`, skills only, both kinds, user scope, neither kind exit 1, unknown skill, symlink target exit 1 with `--force`, dry run, interactive (4 prompts), no skills prompt without skills, empty interactive selection, decline, conflict exit 2/force/skip/overwrite | None                                                        |
| 4.3  | same                              | Integration | same       | same run                                                            | 39/39; full 277/277 | as 4.2                                                                                                                                                                                                                                                                              | `printPlan` row helper; conflicts unified across both kinds |
| 4.4  | README.md                         | Docs        | n/a        | n/a                                                                 | prettier ok         | n/a                                                                                                                                                                                                                                                                                 | n/a                                                         |
| 4.5  | whole suite                       | Full run    | n/a        | n/a                                                                 | see Verification    | n/a                                                                                                                                                                                                                                                                                 | n/a                                                         |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command | `pnpm vitest run test/adapters/cli` -> 39/39 pass (24 before). Full `pnpm test`: 20 files, 277 tests pass (was 261)                                                                                                                                          |
| Runtime harness      | `runCli` end to end against real NodeFileSystem on temp dirs and the bundled catalog: `init --skills example-skill` installs into `.claude/skills/`, `undo` reverts; conflict exits 2 with nothing written; `--force` replaces and undo restores; both kinds |
| Rollback boundary    | Revert the slice-4 PR: prompter port and clack adapter, `program.ts`, CLI tests, README. Domain, application and ports from slices 1-3 are untouched                                                                                                         |

### Verification

`pnpm test` 277/277, `pnpm run typecheck`, `lint`, `format:check`, `build`, `smoke:pack` all exit 0. `test/architecture.test.ts` unchanged and green.

### Behavior implemented

- `init --skills <csv>`, independent of `--mcps`. If either flag is given, the other kind is not prompted (treated as none); with neither flag, interactive mode prompts MCPs, skills (only when the catalog has skills) and scope.
- Non-interactive = `--yes`, or a kind flag plus `--scope`. Neither kind with `--yes` exits 1; `--yes` without `--scope` exits 1. An empty interactive selection of both kinds exits 1.
- Single `--scope` for both kinds. `printPlan` skips files with no items and prints a row per skill; the "close Claude Code" note shows only when an MCP file is in the plan.
- Conflicts unify MCP and skill items: non-interactive exit 2 listing each; interactive asks `resolveConflict({kind,name,reason})` per item, skip drops the item from the re-plan, overwrite sets force.
- `UnknownSkillError` and `UnsafeTreeError` map to exit 1.
- Clack prompter: MCP multiselect no longer `required` (at-least-one rule lives in the CLI); `selectSkills` added; skill conflict wording; confirm counts locations.
- README documents skills: format, install behavior, safety, limits, downgrade warning, `--source` trust note.

### Deviations from design

- With only one kind flag and no `--scope`, the other kind's prompt is skipped and scope is still asked (design silent).
- The MCP prompt lost `required: true`; the empty-selection check is in `runInit`.
- ClackPrompter has no unit test (thin wrapper over @clack/prompts, as before).

### Slice size

295 inserted, 44 deleted lines in 5 modified files (about 340 changed), under the 400 budget; tests about 60%.

### Still open

S1 frontmatter block scalars/lists, S2 duplicate keys last wins, S-a/S-j umask on writeBytes, S-b mode not hashed, S-h MCP-side dirs not in createdDirs, S-i `exists` follows symlinks. `--profile` and `list` are out of scope by decision.
