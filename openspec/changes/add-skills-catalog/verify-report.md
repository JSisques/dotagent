# Verify report: add-skills-catalog, Slice 1 (tasks 1.1-1.10)

Mode: Strict TDD, hybrid store. Verdict: PASS WITH WARNINGS (0 CRITICAL, 5 WARNING, 3 SUGGESTION).

## Evidence

- `pnpm test`: 19 files, 173 tests passed (exit 0).
- `pnpm run typecheck`: exit 0. `pnpm run lint`: exit 0. `prettier --check src test catalog`: pass.
- `test/architecture.test.ts`: unchanged (git diff empty), green.
- Known: `format:check` fails on untracked openspec artifacts (pre-existing, not fixed).
- Tasks 1.1-1.10 all checked; code state matches. Slices 2-4 not yet implemented (out of scope).

## Spec scenario coverage (catalog delta, slice 1)

| Scenario                                        | Test                                                                      | Status                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Valid MCP item / Invalid item / Literal secret  | schema.test.ts, folder-source.test.ts                                     | COMPLIANT                                                          |
| Valid skill                                     | folder-source "loads a skill with a binary file"                          | COMPLIANT                                                          |
| Reserved folders                                | folder-source "ignores reserved folders"                                  | COMPLIANT                                                          |
| Missing description                             | skill.test.ts (domain only); no loader test naming `skills/demo/SKILL.md` | PARTIAL (W2)                                                       |
| Name mismatch                                   | folder-source "skips an invalid skill"                                    | COMPLIANT                                                          |
| Listed but missing                              | folder-source "flags a listed skill with no directory"                    | COMPLIANT (asserts length only)                                    |
| Unlisted directory                              | folder-source "not listed in catalog.json"                                | COMPLIANT                                                          |
| Extends / Skills resolved / Cycle / Unknown ref | profile.test.ts                                                           | COMPLIANT                                                          |
| Traversal (`../evil` named)                     | schema.test.ts rejects, but does not assert the value is named            | PARTIAL (W1)                                                       |
| Symlink                                         | folder-source + walk tests                                                | COMPLIANT (issue file is `skills/linked`, reason names `leak.txt`) |
| Over limit (size, count)                        | walk.test.ts only; no loader-level test                                   | PARTIAL (W3)                                                       |
| Bundled load                                    | bundled-catalog.test.ts                                                   | COMPLIANT                                                          |

## Strict TDD audit

Evidence table present for 10/10 tasks; test files exist and pass. Gaps: 1.7 node-fs RED not run separately (impl written right after test); 1.6 types-only. No tautologies, ghost loops, or smoke-only assertions found.

## Design adherence

Hexagonal purity holds (domain imports only domain; UnsafeTreeError in ports, noted deviation; walk adapter imports domain limits/ports). treeHash, limits, readBytes/listFiles match design.

## Issues

CRITICAL: none.
WARNING:

- W1 Traversal: `items.skills: ["../evil"]` fails the whole catalog with a zod message (path `items.skills.0`, pattern text) that does NOT contain `../evil` (verified from zod output). Spec says it fails naming `../evil`. Test title claims "naming the value" but asserts only `skills`.
- W2 Missing description: issue file is `skills/demo`, not `skills/demo/SKILL.md` as the spec says; no loader-level test.
- W3 Over-limit scenario has no loader-level test (only walk/listTree tests).
- W4 Unlisted scan flags any entry in `skills/` (e.g. macOS `.DS_Store`, README.md) as an invalid unlisted skill.
- W5 TOCTOU: `scan` uses lstat, then `readFile` follows symlinks; a file swapped to a symlink between the two is read. realpath check covers only the root; size is re-checked after the full read. Low risk for a local trusted-ish source.
  SUGGESTION:
- S1 Frontmatter parser rejects block scalars and lists (`description: >`, `allowed-tools:` lists) common in real skills; document or widen in a later slice.
- S2 Duplicate frontmatter keys: last wins silently.
- S3 Slice is ~660 lines vs 400 budget (already noted in apply-progress).
  Not yet implemented (out of scope): slices 2-4 (tasks 2.1-4.5) and specs skills-install, install-safety, mcp-install.

---

# Slice 2 (tasks 2.1-2.6): write-side foundations

Verdict: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 5 SUGGESTION). Mode: Strict TDD.

## Evidence (executed)

- `pnpm test`: 20 files, 221/221 pass. `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`: all exit 0.
- `test/architecture.test.ts`: no diff, green. skill-plan.ts imports only domain modules (type-only `Action` from change-plan.ts; change-plan.ts type-imports `SkillChange`). Cycle is type-only, erased at build, lint clean.
- Tasks 2.1-2.6 all `[x]`; 3.x and 4.x unchecked and out of scope (not yet implemented, not failures).

## Spec-scenario coverage (slice 2 scope)

| Requirement / scenario                                                             | Test                                  | Status                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| Scope targets user/project skillsDir                                               | target.test.ts (user, project)        | COMPLIANT                                 |
| writeBytes atomic temp+rename, 0644, no temp left, failed rename keeps target      | node-fs.test.ts                       | COMPLIANT                                 |
| removeDir non-recursive: false when missing / non-empty                            | node-fs.test.ts                       | COMPLIANT                                 |
| Manifest kind skill, tree hash, createdDirs, no version bump; old manifest parses  | manifest.test.ts                      | COMPLIANT (fixture is synthetic, see S-d) |
| afterHash null for deleted file                                                    | manifest.test.ts                      | COMPLIANT                                 |
| deriveOwnership ignores skills; deriveSkillOwnership by root, undone ignored       | manifest.test.ts                      | COMPLIANT                                 |
| Classification create / skip / update / owned-modified conflict / unowned conflict | skill-plan.test.ts, init-mcps.test.ts | COMPLIANT                                 |
| --force replaces differing tree; identical still skips; removed files listed       | skill-plan.test.ts, init-mcps.test.ts | COMPLIANT                                 |
| Unknown skill name -> UnknownSkillError                                            | init-mcps.test.ts                     | COMPLIANT                                 |
| Target symlink (root and inner) fails planning even with --force                   | init-mcps.test.ts (real FS)           | COMPLIANT                                 |
| Skills-only run plans no MCP file                                                  | init-mcps.test.ts                     | COMPLIANT                                 |
| Undo null-safety (absent file not drift, restore, reappeared file refused)         | undo-install.test.ts                  | COMPLIANT                                 |
| applyPlan writes skills, rollback, undo pruning, --skills CLI, prompts, README     | none                                  | NOT YET IMPLEMENTED (slices 3-4)          |

## Strict-TDD audit

RED evidence present for 2.1, 2.2, 2.3, 2.5, 2.6. Task 2.4 had no RED by design (pre-existing hashOf null handling), disclosed; acceptable. 2.5 triangulation is solid.

## Defect hunt

- Tree hash: sorted by code-unit path, `path NUL sha256 LF`, order independent, POSIX paths (assertSafeRelPath rejects backslash/`..`/NUL). Walk and hash use the same ordering. No defect.
- Edge cases: empty present dir -> treeHash null -> classified `create` (tested). Extra user file in an owned skill -> hash differs -> conflict (correct per spec). Identical content with different mode -> `skip` (mode is not hashed; design-consistent, see S-b).
- Manifest backward compat: `createdDirs` default parses old shape; only synthetic fixture.
- W5 (carried over) STILL OPEN: `readPresent` does listFiles (lstat) then readBytes (plain readFile, follows symlinks); a file swapped for a symlink in between is read. A file vanishing in between is silently dropped (readBytes null), yielding a hash mismatch rather than an error.

## Issues

CRITICAL: none.

WARNING

- W6 (=W5 target side): `readPresent` TOCTOU between listFiles lstat and readBytes follow-symlink read; also silently skips files that vanish. Slice 3 apply must re-check (task 3.2 StaleFileError covers staleness, not symlink swap).
- W7: `planInit` does not de-duplicate `req.skills`; a repeated name yields two plan entries for the same root, which slice 3 apply would write twice and record twice. Dedupe in planInit or the CLI (slice 4).

SUGGESTION

- S-a: writeBytes mode 0644 is subject to process umask (`open(..., mode)`); under umask 077 files become 0600. Tests pass under 022 only. Consider explicit chmod if exactness matters.
- S-b: tree hash ignores file mode; document in the design/README that mode-only differences are `skip`.
- S-c: manifest `afterHash` nullable also for mcp-bearing files; schema could restrict null to skill files.
- S-d: add a literal pre-change manifest JSON fixture (not `{...x, createdDirs: undefined}`) to lock back-compat.
- S-e: slice is about 604 lines (over 400 budget); `size:exception` recommended (disclosed).

Next: sdd-apply slices 3-4 (consider W7 and W6 there).

---

# Verify report: add-skills-catalog, Slice 3 (tasks 3.1-3.5)

Mode: Strict TDD, hybrid store. Branch `feat/skills-catalog-3-apply-undo` (uncommitted, stacked on slice 2). Verdict: PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 5 SUGGESTION).

## Evidence

- `pnpm test`: 20 files, 254 tests passed (exit 0). `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`: exit 0.
- `test/architecture.test.ts`: unchanged (git diff empty), green. `src/domain/plan/skill-plan.ts` only gained a type-only `Scope` import from `ports`, which the architecture test allows.
- Tasks 3.1-3.5 all checked; code matches. Slice 4 (CLI `--skills`, `selectSkills`, at-least-one rule, `printPlan`, README) not implemented: out of scope, not a failure.
- Runtime probes (temporary test file, deleted afterwards; working tree unchanged): backup deleted before undo, symlinked skill file on undo, mixed MCP+skill undo, symlinked `.claude/skills`, file mode.
- `gentle-ai sdd-verify-validate` is not available in the installed binary; the report was persisted without the validator (same as slices 1 and 2).

## Spec scenario coverage (install-safety, skills-install, slice 3)

| Scenario                                         | Test                                                                                | Status                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------- |
| Manifest written (mcp + skill in one record)     | init-mcps "records MCPs and skills in a single install"                             | COMPLIANT               |
| Failure mid-skill (third of four)                | rollback "third of four writes fails" (reverse order, dirs gone, no manifest)       | COMPLIANT               |
| Failure during forced replace                    | rollback "restores a forced replace byte-identical ..." (backups kept)              | COMPLIANT               |
| Clean undo of created skill                      | undo "removes a created skill and every directory it created"                       | COMPLIANT               |
| User-added file / Skill drift or extra file      | undo "refuses with exit 3 ... user added a file"                                    | COMPLIANT               |
| Changed since install (skill file)               | undo "refuses when a recorded file was modified or deleted"                         | COMPLIANT               |
| Pre-existing parent kept                         | undo "keeps a skills directory that existed before the install"                     | COMPLIANT               |
| Undo of forced replace                           | undo "restores the original directory, binary file included"                        | COMPLIANT               |
| Undo of update with dropped file                 | undo "undoes an update back to the previous version, dropped file included"         | COMPLIANT               |
| `--force` keeps unknown files                    | undo "with --force removes the recorded files but leaves the unknown file"          | COMPLIANT               |
| Same-root LIFO                                   | undo "blocks undoing an older install while a newer one owns the same skill root"   | COMPLIANT               |
| Dry run (apply)                                  | init-mcps "writes nothing for a skip, a conflict, or a dry run"                     | COMPLIANT               |
| Create/update/force/skip apply, SKILL.md last    | applyPlan (skills) tests (create+binary, createdDirs, SKILL.md last, update, force) | COMPLIANT               |
| Stale directory at apply                         | "aborts with StaleFileError when the skill directory changed since planning"        | COMPLIANT               |
| Orphan after incomplete rollback                 | "reports an incomplete rollback ... flags as a conflict"                            | COMPLIANT               |
| MCP written earlier rolled back                  | "puts an MCP config written earlier in the same install back"                       | COMPLIANT (beyond spec) |
| Backup write failure                             | "touches nothing in the target when a backup write fails"                           | COMPLIANT               |
| Undo dry run                                     | undo "reports an unknown file on dry run and writes nothing"                        | COMPLIANT               |
| Symlinked skill file on undo: spec says refuse 3 | probe: raises UnsafeTreeError (exit 1), untested                                    | PARTIAL (W-a)           |

## User decision check (non-empty createdDir with only foreign files)

Implemented and tested ("skips a created directory that is not empty because of an unrelated user file"): undo succeeds, the directory stays. Refusal only for a modified/missing recorded file or an unrecorded file under an installed skill root. Wording that does not state or that can be read against this decision (reconcile, not edited):

- `design.md:33`: "With `--force`, unknown files stay and `removeDir` skips non-empty directories." Reads as if skipping only happens under `--force`; in fact skipping is unconditional (it only concerns directories outside any skill root). Reword to "`removeDir` always skips non-empty directories; `--force` only overrides drift refusal".
- `design.md:27` (data flow, "prune createdDirs (deepest first)") and `design.md:13` do not mention the silent skip.
- `specs/skills-install/spec.md:108` ("remove only directories shitaku created") and `specs/install-safety/spec.md:18` ("remove only files and directories shitaku created") are compatible but no scenario covers "created dir holds only foreign files: undo succeeds, dir kept". Add one scenario to each.
- `tasks.md:71` (3.4) does not list the skip case; apply-progress already records it as a deviation.

## Strict TDD audit

- Evidence table present for 3.1-3.5 (safety net, RED counts, GREEN, triangulation, refactor). RED counts credible: 8 failed (3.1/3.2), 4 of 5 failed (3.3; backup-failure case already green, disclosed), 10 failed (3.4/3.5).
- Tests exercise the real `NodeFileSystem` on temp dirs with a `faultyFs` wrapper; no mock-only assertions. Assertions are behavioral (byte-identical trees, call order, directory listings).
- Gap: no test for mixed MCP+skill undo, backup-missing undo, symlink-on-undo, or failing rollback of MCP restore.
- Slice is about 640 lines (budget 400), tests about 60%; `size:exception` recommended (disclosed).

## Design adherence

- Backups first, `createdDirs` computed via `exists` before any write, SKILL.md last per skill, manifest appended last, single Install record: matched. Rollback in reverse then dirs deepest first with non-recursive `removeDir`: matched. Dry run returns before apply (writes nothing): matched.
- Deviations (disclosed, acceptable): `scope` on `SkillPlanEntry`/`SkillChange`; rollback also covers MCP files; every file of an updated skill is rewritten and recorded.
- Hexagonal purity: application imports only domain and ports; no `fs` or `os` in domain.

## Defect hunt results

- Rollback failing midway: every step is attempted, the original error is returned annotated `rollback incomplete`; orphan dir is reported as conflict. Good. Rollback of MCP restore failing is not tested.
- Backups after a failed apply are kept (`backups/<id>/`), unreferenced by any manifest entry; no cleanup path, so they accumulate. Consistent with the design ("plus the backups on disk") and useful for manual recovery; not in install-safety.
- Secrets: `assertNoLeak` still runs on the MCP files before any write; skills are not scanned (design decision). Backups of foreign skill files are copied verbatim into the state dir (could contain user secrets, same as MCP backups).
- Crash between last write and manifest append: same outcome as incomplete rollback (unowned dir, next plan flags conflict; files are not recorded so `undo` cannot revert). Recovery needs `--force`, which replaces with backup. Acceptable per design.
- `createdDirs` with partially pre-existing parents: only missing ancestors recorded, parents first (tested). `exists` uses `stat` (follows symlinks): a dangling-symlink ancestor would count as missing.
- Same skill root in two installs: second apply of an owned tree is `update`/`skip`; undo blocked by root LIFO (tested).
- Undo with a deleted backup (probe): restore throws `UndoVerifyError` after earlier files were already restored or removed; the manifest stays not-undone, and a rerun refuses with exit 3 listing the restored files as drift (W-b).
- Mixed MCP+skill undo (probe): status undone, `.mcp.json` byte-identical, project dir left empty. Correct.
- Symlinked `.claude/skills` (probe): install writes through the link, undo removes the skill and leaves the symlink and its target intact. Correct.
- Mode (probe): files are 0644 under umask 022; umask effect carried as S-a. Large binary: bounded by the 1 MiB per-file limit on both sides; `readBytes` limit means a foreign file above it makes planning/undo fail with `UnsafeTreeError`.

## Issues

CRITICAL: none.

WARNING

- W-a: Undo of an install whose skill file was replaced by a symlink (or special file) throws `UnsafeTreeError` (exit 1) while the spec ("refuse ... exit non-zero", install-safety "Changed since install") and the apply-progress note expect a refusal with exit 3. `currentHash` in `src/application/undo-install.ts` calls `readBytes`, which uses `O_NOFOLLOW`; `unrecordedFiles` via `listFiles` throws the same way for a symlink under the root. Catch `UnsafeTreeError` in the drift scan and report the path as changed; add a test.
- W-b: `undoInstall` is not atomic and does not pre-check backups: with a missing backup it restores/removes earlier files, throws on the missing one and leaves the manifest un-undone; a rerun then refuses (exit 3) with the restored files shown as drift, and only `--force` recovers. Verify all backups exist (readBytes/readText non-null) before the first mutation.
- W-c: Design/spec wording on the user decision needs reconciling (see section above, `design.md:33`, plus missing scenarios).
- W-d: Failed-apply backups are retained indefinitely with no manifest reference and no documented cleanup; mention in design/README (slice 4) or delete backups created by the failed install after a complete rollback.

SUGGESTION

- S-f: Add tests for mixed MCP+skill undo, backup-missing undo, symlink-on-undo and a failing MCP restore during rollback.
- S-g: `createdDirs` from the manifest are `rmdir`ed as recorded; a tampered manifest could prune any empty directory. Consider asserting they lie under a recorded skills dir.
- S-h: MCP-side directories created by `writeAtomic` (mkdirp) are not tracked in `createdDirs`; skills only.
- S-i: `exists` follows symlinks (dangling link counts as missing).
- S-j: Carried: umask on `writeBytes` (S-a), mode not hashed (S-b), frontmatter block scalars (S1) and duplicate keys (S2). W7 (dedupe) is resolved by the slice-2 remediation test.

Next: sdd-apply for W-a and W-b (optional; non-blocking), then slice 4.

---

# Verify report: add-skills-catalog, Slice 4 (tasks 4.1-4.5) and final whole-change verdict

Mode: Strict TDD, hybrid store. Slice 4 verdict: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING, 5 SUGGESTION). Final whole-change verdict: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 9 SUGGESTION), ready for archive after the delta-spec fixes in W-f are applied (or accepted).

## Evidence (slice 4, working tree uncommitted)

- `pnpm test`: 20 files, 277 tests passed. `typecheck`, `lint`, `format:check`, `build` (check-dist-aliases: 25 files clean), `smoke:pack`: all exit 0. `test/architecture.test.ts` unchanged (git diff empty).
- tasks.md has 26 task lines (S1 10, S2 6, S3 5, S4 5), all `[x]`, 0 unchecked; code matches. apply-progress says "All 31 tasks" and the request said 31, but the file has 26 (documentation count error, S-p).
- `gentle-ai sdd-verify-validate` does not exist in the installed binary; report persisted without it (as in slices 1-3).

## Real built CLI run (node dist/main.js, temp HOME and cwd, stdin /dev/null)

| Case                                                                      | Observed                                                                                                                                             | Exit  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `init --help`                                                             | lists `--skills`, `--yes (requires --scope and --mcps and/or --skills)`, `--force` text mentions skill dirs                                          | 0     |
| `init --skills example-skill --scope project --dry-run`                   | one row `example-skill: create` under the skill dir, no MCP file line, no "close Claude Code" note, "dry run: nothing was written"; no files created | 0     |
| same with `--yes`                                                         | created `.claude/skills/example-skill/SKILL.md`; manifest in HOME `.claude/.shitaku/`                                                                | 0     |
| repeat                                                                    | `example-skill: skip (already installed)`, "nothing to change"                                                                                       | 0     |
| after editing the installed SKILL.md, no `--force`                        | `conflict: skill 'example-skill' already exists with different content` / `unresolved conflicts; re-run with --force`; file untouched                | 2     |
| same plus `--force`                                                       | `example-skill: update (replaced by --force)`                                                                                                        | 0     |
| `undo --dry-run`, `undo`                                                  | would restore / restored the SKILL.md (LIFO: undid the force install)                                                                                | 0     |
| fresh HOME: install then `undo`                                           | project dir back to empty (created dirs pruned)                                                                                                      | 0     |
| pre-existing user `example-skill/SKILL.md` ("mine"): `--yes`              | exit 2, file still "mine"; `--force` replaces; `undo` restores "mine" byte for byte                                                                  | 2/0/0 |
| `--skills nope --yes --scope project`                                     | `error: unknown skill: nope`                                                                                                                         | 1     |
| `--scope project --yes` (neither kind)                                    | `error: select at least one kind: pass --mcps and/or --skills`                                                                                       | 1     |
| `--skills example-skill --yes` (no scope)                                 | `error: --yes requires --scope`                                                                                                                      | 1     |
| target skill dir is a symlink, `--force`                                  | `error: ... is a symbolic link`                                                                                                                      | 1     |
| `--mcps github --skills example-skill --scope project --yes`, then `undo` | both in one install and one undo; `.mcp.json` and skill dir removed                                                                                  | 0     |
| `--mcps github --skills example-skill --scope user --dry-run`             | MCP file row, skill row, env warning and the "close Claude Code" note (only because an MCP file is in the plan)                                      | 0     |
| `--skills example-skill --scope project --scope user --yes`               | silently takes the last `--scope` (user)                                                                                                             | 0     |
| `--skills example-skill` without scope, no TTY                            | opens the scope prompt and hangs ("unsettled top-level await" warning); same pre-existing behavior as MCP-only flag mode                             | n/a   |

## Slice 4 compliance matrix (mcp-install delta + skills-install CLI scenarios)

| Scenario                                                                       | Test (test/adapters/cli/program.test.ts) / run                                             | Status    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------- |
| Init flow: Interactive (MCPs, skills, scope, confirm)                          | "prompts for MCPs, skills, scope and confirmation, then installs the skill"                | COMPLIANT |
| Interactive without skills                                                     | "skips the skills prompt when the catalog has no skills"                                   | COMPLIANT |
| Non-interactive                                                                | "installs without prompting when --mcps and --scope are given"                             | COMPLIANT |
| Skills only (no MCP file touched)                                              | "installs only skills without touching the MCP file, then undo reverts"                    | COMPLIANT |
| Both kinds in one install                                                      | "installs both kinds under one scope and undoes them together"                             | COMPLIANT |
| Neither kind                                                                   | "exits 1 with --yes and neither ..."; real run exit 1                                      | COMPLIANT |
| Empty interactive selection of both kinds                                      | "exits 1 when the interactive selection is empty for both kinds"                           | COMPLIANT |
| Unknown MCP / unknown skill                                                    | "exits non-zero naming an unknown MCP", "exits 1 naming an unknown skill"                  | COMPLIANT |
| Program name / help lists `--skills`                                           | "prints help", "lists --skills in init help"                                               | COMPLIANT |
| Skill scope targets (user/project)                                             | "installs at user scope", project cases, real run                                          | COMPLIANT |
| Non-interactive conflict (exit 2, nothing written)                             | skills "exits 2 non-interactively ..." and real run                                        | COMPLIANT |
| Interactive conflict skip / overwrite (`{kind,name,reason}`)                   | "asks per skill conflict interactively and honours skip / overwrite"                       | COMPLIANT |
| Interactive decline                                                            | "writes nothing when the interactive confirmation is declined"                             | COMPLIANT |
| Force replace after backup, undo restores byte for byte                        | "replaces the whole directory with --force after a backup, and undo restores it"; real run | COMPLIANT |
| Symlinked target                                                               | "exits 1 when the target skill directory is a symlink, even with --force"; real run        | COMPLIANT |
| Dry run                                                                        | "prints the plan and writes nothing on --dry-run"; real run                                | COMPLIANT |
| printPlan: skills-only has no MCP file; row per skill; note only with MCP file | assertions on `text()` plus real runs                                                      | COMPLIANT |

## README accuracy

Matches the real flags, exit codes, backup location, `--force` semantics (replaces the whole dir, deletes files not in the catalog), rollback keeps backups, undo exit 3 on drift, `--force` keeps unknown files, created dirs removed only when empty, downgrade warning, `--source` trust note, and the "no `list` or profile" limit (checked against the real runs). Not documented: the umask/mode caveat (S-a/S-b), that failed-apply backups are never cleaned (README says "Backups stay on disk", acceptable), and the 1 MiB per-file limit number (limits are mentioned generically).

## Slice 3 remediation re-check (never formally verified before)

| Item                                                     | Evidence                                                                                                                                                                                                                 | Status                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| W-a symlinked recorded file / symlink under root on undo | undo-install.test.ts: "refuses with exit 3, not a crash, when a recorded file was replaced by a symlink", "... user added a symlink under the skill root"; code maps `UnsafeTreeError` to drift (undo-install.ts:76,108) | RESOLVED                                |
| W-b missing backup                                       | "refuses before touching anything when a needed backup is missing, and again on rerun"; `assertBackupsPresent` runs before restores                                                                                      | RESOLVED                                |
| S-g tampered createdDirs                                 | "ignores a tampered createdDirs entry that lies outside the install scope"; `prunableDirs` filter                                                                                                                        | RESOLVED                                |
| User decision: foreign-only created dir skipped          | two tests (lines 211, 341)                                                                                                                                                                                               | RESOLVED                                |
| W-c/W-d docs reconciliation                              | design.md and the delta specs now carry the foreign-only and symlinked-file scenarios, the missing-backup and kept-backups text; tasks 3.4 updated                                                                       | RESOLVED with a structural caveat (W-f) |

## Final verdict against issue #15 acceptance criteria

| #   | Criterion                                                                | Executed evidence                                                                                                                                                                                                                                                                      | Status |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Catalog schema supports skills and is validated on load                  | schema.test.ts (default `[]`, `../evil` rejected naming the value), skill.test.ts (frontmatter, name mismatch, limits), folder-source.test.ts (invalid skipped with reason, unlisted and listed-but-missing flagged), bundled-catalog.test.ts; real run loaded bundled `example-skill` | MET    |
| 2   | `init` installs a selected skill and `undo` reverts it                   | real CLI: install, undo to empty dir; forced replace and undo restore byte for byte; mixed MCP+skill undo; CLI tests                                                                                                                                                                   | MET    |
| 3   | Existing user skills never overwritten silently                          | real CLI: conflict reported in plan, exit 2, file unchanged; `--force` only after backup; interactive ask per skill                                                                                                                                                                    | MET    |
| 4   | Tests cover plan, apply and undo for skills; typecheck/build/vitest pass | skill-plan.test.ts, init-mcps.test.ts (apply, rollback), undo-install.test.ts, program.test.ts; 277/277, typecheck, lint, format:check, build, smoke:pack exit 0                                                                                                                       | MET    |
| 5   | README documents the skills kind                                         | README "Skills" section, flags, scopes, safety, downgrade, trust note; accuracy checked against real runs                                                                                                                                                                              | MET    |

## Carried open items classification

| Item                                         | Classification | Rationale                                                                                                                           |
| -------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| S1 frontmatter block scalars/lists           | non-blocking   | README documents "single-line name and description"; a block scalar is rejected as invalid (skipped with a warning), not mis-parsed |
| S2 duplicate frontmatter keys, last wins     | non-blocking   | no safety impact; name must still equal the directory                                                                               |
| S-a umask on writeBytes, S-b mode not hashed | non-blocking   | files written 0644 under umask 022; no mode bit restored on undo/replace; document as a known limit                                 |
| S-h MCP-side dirs not in createdDirs         | non-blocking   | MCP files only; pre-existing behavior                                                                                               |
| S-i `exists` follows symlinks                | non-blocking   | dangling link counts as missing; the write path still uses O_NOFOLLOW guards and symlinked targets exit 1                           |

## Delta spec consistency for archive

- MODIFIED requirement names (`Init flow`, `Manifest`, `Undo`, `Catalog layout and schema`, `Item validation`, `Profile extends`) all exist verbatim in `openspec/specs/{mcp-install,install-safety,catalog}/spec.md`, so a sync will replace them correctly. `skills-install` is a new capability (full spec, no delta header), and `ADDED` names (`Source guards and limits`, `Bundled example skill`, `Multi-file write failure`) do not collide.
- The mcp-install MODIFIED `Init flow` replaces the whole requirement, so its scenarios (Interactive, Interactive without skills, Non-interactive, Skills only, Both kinds, Neither kind, Unknown MCP, Program name) must be the complete set; they are. Main spec's other requirements (Scope targets, Merge, Existing entries, Required env) stay untouched, correct.
- W-f (WARNING, archive hygiene): in `install-safety/spec.md` the paragraph "Backups written for an install that then fails ..." is plain text sitting between two scenarios of `Multi-file write failure`, so a parser attaches it to the previous scenario, and the `Missing backup at undo` scenario sits under `Multi-file write failure` although it is undo behavior (belongs under the MODIFIED `Undo`). After sync the main spec would carry it under the wrong requirement. Move the scenario to `Undo` and fold the backups paragraph into the `Multi-file write failure` requirement body.
- The `Undo` MODIFIED text ("MUST refuse when the skill directory contains user-added files") does not mention the foreign-only created-dir skip; the scenario in skills-install covers it. The main `Undo` requirement would still read "remove only files and directories shitaku created", compatible.
- Spec requirement/scenario heading count across the four capability specs: 64 headings (`### Requirement:` plus `#### Scenario:`) in specs/.

## Issues

CRITICAL: none.

WARNING

- W-e (slice 4): the interactive scope prompt hint reads `Project (./.mcp.json)` (`src/adapters/cli/clack-prompter.ts:41`), which is MCP-only wording and misleading for a skills-only run (project skills go to `./.claude/skills/`). Reword the hint (for example `./.mcp.json, ./.claude/skills/`) or drop it.
- W-f: delta spec structure for archive (see above): move `Missing backup at undo` into `Undo` and attach the backups paragraph to the requirement body.

SUGGESTION

- S-k: `--scope` given twice silently takes the last value (commander default); the issue decision says single scope. Optional: reject duplicates.
- S-l: `init --skills x` without `--scope` and without a TTY hangs on the scope prompt (unsettled top-level await). Pre-existing for `--mcps` flag mode; consider failing fast when stdin is not a TTY.
- S-m: `ClackPrompter` has no unit test (thin wrapper, disclosed); `selectSkills`, new conflict wording and `confirm` location count are only exercised by the fake.
- S-n: README does not mention the umask/mode caveat or the per-file size number.
- S-o: slices 1-3 exceeded the 400-line budget (disclosed; slice 4 is about 340 lines); recommend `size:exception` where flagged.
- S-p: apply-progress.md says "All 31 tasks complete" but tasks.md has 26; correct the number.
- Carried non-blocking: S1, S2, S-a/S-j, S-b, S-h, S-i (above).

Next: archive. No source change is required; apply only the doc fixes in W-e (one line) and W-f (spec move) before or during archive.
