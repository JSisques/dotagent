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
