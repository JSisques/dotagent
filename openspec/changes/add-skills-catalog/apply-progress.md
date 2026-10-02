# Apply progress: add-skills-catalog

## Slice 1 (tasks 1.1-1.10): DONE. Mode: Strict TDD. Branch: feat/skills-catalog-1-read-side

Completed: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10. Remaining: slices 2-4 (2.1-4.5).

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
