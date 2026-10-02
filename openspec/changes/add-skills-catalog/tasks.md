# Tasks: Add installable skills to the catalog (issue #15)

Strict TDD (config.yaml): every unit is RED test, then GREEN code. Run `pnpm test`, `pnpm run typecheck`, `pnpm run format:check` per slice. `test/architecture.test.ts` stays unchanged.

## Review Workload Forecast

| Field                   | Value                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~1700 total: S1 ~450, S2 ~450, S3 ~500, S4 ~300 (src plus tests)                            |
| 400-line budget risk    | High                                                                                        |
| Chained PRs recommended | Yes                                                                                         |
| Suggested split         | PR 1 (catalog read side) -> PR 2 (write side + planning) -> PR 3 (apply/undo) -> PR 4 (CLI) |
| Delivery strategy       | auto-chain                                                                                  |
| Chain strategy          | pending (recommend stacked-to-main)                                                         |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Chain strategy is an orchestrator decision. Recommendation: stacked-to-main. Each slice is backward compatible and shippable alone (S1 adds an unused example skill, S2 adds unused ports and widens the manifest, S3 adds unreachable apply paths until S4). Feature-branch-chain is the alternative if we want no half-feature on main; the cost is a long-lived branch. S1, S3 may exceed 400; trim by moving tests out only if review demands.

### Suggested Work Units

| Unit | Goal                                                   | Likely PR | Focused test command                                                           | Runtime harness                                   | Rollback boundary                           |
| ---- | ------------------------------------------------------ | --------- | ------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| 1    | Load and validate skills from catalog                  | PR 1      | `pnpm vitest run test/domain test/adapters`                                    | Load bundled catalog in `bundled-catalog.test.ts` | Revert PR 1 (additive)                      |
| 2    | Write-side FS, skillsDir, skill plan, widened manifest | PR 2      | `pnpm vitest run test/domain test/adapters test/application/init-mcps.test.ts` | Plan against in-memory FS                         | Revert PR 2 (additive; old manifests parse) |
| 3    | Apply, rollback, undo for skills                       | PR 3      | `pnpm vitest run test/application`                                             | Faulty-FS fake, apply then undo                   | Revert PR 3                                 |
| 4    | CLI flags, prompts, README                             | PR 4      | `pnpm vitest run test/adapters/cli`                                            | Scripted prompter run of `init`/`undo`            | Revert PR 4                                 |

Base branches (stacked-to-main): each PR targets `main` after the previous merges. (feature-branch-chain: PR1 base = tracker; PRn base = PRn-1.)

## Spec/design reconciliation

- Owned-but-modified skill = `conflict`: design `classifySkill` already yields it (`owned[root] !== present`). No change.
- Unlisted skill directory = invalid: design is silent. Task 1.9 adds a `skills/` directory scan in the loader.
- `items.skills` optional, default `[]`: matches design (task 1.2).
- `items.skills` entry `../evil`: design rejects via name regex; spec says "fails naming". Schema failure names the value (1.2). Per-skill walk guards cover the rest.
- Unknown `--skills` name and neither-kind exit: spec-only; design omits. Tasks 2.6 and 4.2.
- Manifest widening (S2) changes `afterHash` to nullable, so `undo-install.ts` must compile in S2: task 2.4 adds a minimal null-safe path; full logic in S3.
- `resolveConflict` signature change touches MCP call sites: kept in S4 (task 4.1).

## Slice 1: Catalog schema and read side

- [x] 1.1 RED then GREEN `src/domain/catalog/limits.ts` constants; test in `test/domain/catalog/skill.test.ts` (design Interfaces)
- [x] 1.2 `src/domain/catalog/schema.ts`: `items.skills` regex array default `[]`; tests in `schema.test.ts`: absent defaults empty, `../evil` rejected (catalog Source guards/Traversal)
- [x] 1.3 `src/domain/catalog/skill.ts`: minimal frontmatter parser plus `SkillItem`; tests: valid, missing description, multi-line value, name mismatch, no frontmatter (catalog Item validation)
- [x] 1.4 `src/domain/hash.ts`: bytes input plus `treeHash`; tests: order independence, null for empty, text hash equality
- [x] 1.5 `src/domain/catalog/profile.ts`: `Profile.skills`, resolve returns `{mcps, skills}`; tests in `profile.test.ts`: dedupe, extends, cycle, unknown skill (catalog Profile extends)
- [x] 1.6 `src/ports/file-system.ts`, `src/ports/catalog-source.ts`: `readBytes`, `listFiles`; types only
- [x] 1.7 `src/adapters/fs/walk.ts` plus `node-fs.ts` readBytes/listFiles; tests in `node-fs.test.ts`/new `walk.test.ts` with temp dirs: symlink (file, root), `..`, backslash, oversize, count, depth, total size
- [x] 1.8 `src/adapters/catalog/folder-source.ts`: load skills via walk; test in `folder-source.test.ts`: valid skill with binary file, invalid skipped while valid remain
- [x] 1.9 Loader: scan `skills/` and flag unlisted directories and listed-but-missing; tests for both (catalog Name mismatch or unlisted)
- [x] 1.10 Add `catalog/skills/<example>/SKILL.md`, update `catalog/catalog.json`; test in `bundled-catalog.test.ts` (Bundled load)

## Slice 2: Write side, skillsDir, planning, manifest

- [ ] 2.1 `file-system.ts` plus `node-fs.ts`: `writeBytes`, `exists`, `removeDir`; tests: tmp+rename, non-empty returns false, missing returns false
- [ ] 2.2 `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`: `skillsDir`; tests in `target.test.ts` (user/project scope)
- [ ] 2.3 `src/domain/manifest.ts`: Item discriminated union, `afterHash: string|null`, `createdDirs` default `[]`, `deriveSkillOwnership`; tests: old manifest parses, skill item, null hash
- [ ] 2.4 Make `undo-install.ts` compile with nullable hash (minimal, mcp behavior unchanged); existing tests green
- [ ] 2.5 `src/domain/plan/skill-plan.ts` plus `change-plan.ts`: `classifySkill`, `ChangePlan.skills`; tests: create, skip, update, owned-modified conflict, unowned conflict, force update, removed files listed
- [ ] 2.6 `src/application/init-mcps.ts` planInit: skills via `skillsDir`, unknown skill error, target symlink fails (exit 1 even with `--force`); tests with in-memory FS

## Slice 3: Apply and undo

- [ ] 3.1 RED `init-mcps.test.ts`: apply create/update/force/skip writes bytes, SKILL.md last, one Install record, `afterHash:null` for removed files, `--dry-run` writes nothing
- [ ] 3.2 GREEN `init-mcps.ts` applyPlan skill path: refresh, `StaleFileError`, backups first, createdDirs
- [ ] 3.3 RED then GREEN rollback with faulty FS: third of four writes fails (no manifest entry, dirs removed); forced replace failure restores byte-identical (install-safety Multi-file write failure)
- [ ] 3.4 RED `undo-install.test.ts`: clean undo prunes created dirs deepest-first, keeps pre-existing `~/.claude/skills`, user-added file refuses exit 3, modified file refuses, `--force` keeps unknown files, undo of forced replace restores, same-root LIFO block
- [ ] 3.5 GREEN `src/application/undo-install.ts`: bytes restore, extra-file drift, pruning, root LIFO

## Slice 4: CLI, prompter, docs

- [ ] 4.1 `src/ports/prompter.ts`, `clack-prompter.ts`: `selectSkills`, `resolveConflict({kind,name,reason})`; update MCP call sites and fake prompter
- [ ] 4.2 RED `test/adapters/cli/program.test.ts`: `--skills` only, both kinds, neither kind exits non-zero, unknown skill, `--help` lists `--skills`, exit 2 on non-interactive conflict, skills prompt only when catalog has skills, interactive decline
- [ ] 4.3 GREEN `src/adapters/cli/program.ts`: `--skills`, at-least-one rule, printPlan with skill rows, undo output
- [ ] 4.4 `README.md`: skills usage, `catalog/skills` layout, trust note, downgrade warning (undo before downgrading)
- [ ] 4.5 Run full `pnpm test`, `typecheck`, `format:check`
