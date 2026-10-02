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
