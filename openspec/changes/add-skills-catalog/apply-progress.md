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
