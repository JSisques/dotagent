# Proposal: Add installable skills to the catalog (issue #15)

## Intent

shitaku installs only MCPs today. Its stated purpose is portable agent setups (skills and MCPs). Users need to install catalog skills (`SKILL.md` and resources) with the same safety guarantees: plan, backup, manifest, and undo.

## Scope

### In Scope

- Catalog layout `catalog/skills/<name>/SKILL.md` (+ resources), frontmatter `name`/`description` validated on load, names listed in `catalog.json` `items.skills`.
- `ProfileSchema.skills: []` (schema/resolve only).
- Bytes-capable FS port (binary resources) with size and file-count limits.
- Path traversal, symlink, and size guards for `--source` catalogs.
- Skill planning: create / update (owned, unchanged) / skip (identical) / conflict (present, not owned).
- `--force` replaces a non-owned skill directory after backup.
- Manifest item kind widened to `mcp | skill` (no version bump). One `Install` record covers both kinds.
- Undo reverts skills; it prunes only directories shitaku created and refuses on user-added files.
- CLI: `--skills <csv>`; `--mcps`/`--skills` independent, at least one required (clear error with `--yes`). The `selectSkills` prompt appears only if the catalog has skills. A single `--scope` applies to both (user `~/.claude/skills`, project `<cwd>/.claude/skills`).
- One minimal bundled example skill. README covers the skills kind and the trust note.

### Out of Scope

- `--profile` flag and `list` command.
- Generalized resource abstraction; agents other than Claude Code.

## Capabilities

### New Capabilities

- `skills-install`: skill planning, conflicts, `--force`, apply, undo, and scope targets for skills.

### Modified Capabilities

- `catalog`: skills layout, frontmatter validation, `items.skills`, profile `skills`, source guards and limits.
- `mcp-install`: init flow (`--mcps` optional, at least one kind required, prompt flow, shared `--scope`).
- `install-safety`: manifest kind `mcp | skill`, multi-file atomicity/cleanup, undo directory pruning and drift refusal.

## Approach

This is a hybrid of explore approaches 1 and 2. The manifest stays per-file, so the existing hash, drift, LIFO, and undo code is reused. A per-skill tree hash drives ownership and classification. Conflicts appear in the plan and exit 2 non-interactively. They are never overwritten silently. Multi-file writes are journaled or cleaned up on failure. The domain stays pure: adapters supply contents and hashes.

Affected hexagonal layers:

| Layer       | Paths                                                                                                   | Impact       |
| ----------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| domain      | `src/domain/catalog/{schema,profile}.ts`, `plan/change-plan.ts`, `manifest.ts`                          | Modified     |
| ports       | `file-system.ts`, `agent-target.ts`, `prompter.ts`, `catalog-source.ts`                                 | Modified     |
| application | `init-mcps.ts`, `undo-install.ts`                                                                       | Modified     |
| adapters    | `catalog/folder-source.ts`, `fs/node-fs.ts`, `claude-code/target.ts`, `cli/{program,clack-prompter}.ts` | Modified     |
| assets/docs | `catalog/`, `README.md`, tests                                                                          | New/Modified |

## Risks

| Risk                                   | Likelihood | Mitigation                                          |
| -------------------------------------- | ---------- | --------------------------------------------------- |
| Partial multi-file write               | Med        | Journal first or clean up on failure                |
| Undo deletes user files                | Med        | Prune only dirs created by shitaku; refuse on drift |
| Malicious `--source`                   | Med        | Traversal/symlink/size guards; README trust note    |
| Older shitaku reads `skill` kind       | Low        | Accepted (0.x, no migration)                        |
| Core apply loop is single-file centric | High       | Separate skill path in apply; keep MCP path intact  |

## Rollback Plan

Revert the slice PRs in reverse order. On user machines, `shitaku undo` reverts installs. Manifests containing `skill` items become unreadable by reverted builds, so users must undo before downgrading.

## Review Workload Forecast

Estimated 1200-1600 changed lines, which exceeds the 400-line budget. Chained PRs recommended:

1. Catalog schema, read-side FS (`readBytes`, `listFiles`), skills loading, guards/limits, bundled skill.
2. Write-side FS (`writeBytes`, `exists`, `removeDir`), skills target dir, domain skill planning, manifest kind.
3. Apply and undo for skills (journal, pruning, drift).
4. CLI flags/prompts, `printPlan`, README.

## Success Criteria

- [ ] Skill schema validated on catalog load.
- [ ] `init` installs a skill; `undo` reverts it.
- [ ] Conflicts reported in plan; exit 2 non-interactive.
- [ ] Tests cover plan/apply/undo for skills.
- [ ] `pnpm run typecheck`, build, and `pnpm test` pass.
- [ ] README documents the skills kind.
