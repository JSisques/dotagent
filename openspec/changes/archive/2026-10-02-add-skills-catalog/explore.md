# Exploration: add-skills-catalog (issue #15)

Full analysis lives in Engram `sdd/add-skills-catalog/explore` (id 1089). This file is the openspec mirror.

## Current State

Hexagonal architecture: `src/domain` (pure, guarded by `test/architecture.test.ts`), `ports`, `application`, `adapters`, `main.ts` as composition root.

- **Catalog**: `catalog/catalog.json` is `{version:1, items:{mcps:[], profiles:[]}}`. `items` is a `z.looseObject`, so a `skills` key is tolerated but ignored. `FolderCatalogSource.load()` reads `<dir>/<name>.json` with zod validation.
- **Profiles**: `{name, description?, extends[], mcps[]}`; `resolveProfile` returns MCP names only. No `--profile` flag and no `list` command exist.
- **Planner** (`domain/plan/change-plan.ts`): single-file, JSON-merge centric. `FileChange` holds before/after text; `PlannedItem` is MCP-typed.
- **Apply** (`application/init-mcps.ts`): `refresh` re-hashes and replans once, `assertNoLeak` scans env values, backups go to `~/.claude/.shitaku/backups/<id>/`, then `writeAtomic`, then `appendInstall`.
- **Manifest** (`domain/manifest.ts`): `ItemSchema.kind` is `z.literal('mcp')`; records are per file.
- **Undo** (`application/undo-install.ts`): LIFO per file, drift detection via `afterHash`, exit code 3 on refusal.
- **Ports**: `FileSystem` is utf8-text only (`readText`, `writeAtomic`, `remove`, `mkdirp`). `AgentTarget` is MCP-shaped. `Prompter` has `selectMcps`, `selectScope`, `resolveConflict`, `confirm`, `info`.
- **CLI**: `init` (`--mcps --scope --source --dry-run --yes --force`) and `undo`.
- **Packaging**: `package.json` `files` already includes `catalog`.

## Affected Areas

- `src/domain/catalog/schema.ts`, `profile.ts`: skill schema, `items.skills`, `ProfileSchema.skills`.
- `src/adapters/catalog/folder-source.ts`, `src/ports/catalog-source.ts`: load and validate `skills/<name>/SKILL.md` plus resources.
- `src/ports/file-system.ts`, `src/adapters/fs/node-fs.ts`: `readBytes`, `writeBytes`, `listFiles`, `exists`, `removeDir`.
- `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`: `skillsDir` (user `~/.claude/skills`, project `<cwd>/.claude/skills`).
- `src/domain/plan/change-plan.ts`, `src/domain/manifest.ts`: skill planning and ownership.
- `src/application/init-mcps.ts`, `undo-install.ts`: apply, journal and undo for skills.
- `src/adapters/cli/program.ts`, `clack-prompter.ts`, `src/ports/prompter.ts`: `--skills`, `selectSkills`, `printPlan`.
- `catalog/`, `README.md`, tests, openspec specs (catalog, mcp-install, install-safety deltas; likely new `skills-install` capability).

## Approaches

| #   | Approach                                                                         | Pros                                                                   | Cons                                                                 | Effort      |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| 1   | Parallel skill pipeline; each skill file is an `InstalledFile` with kind `skill` | Reuses hash, drift, LIFO, undo; one install id reverts MCPs and skills | Many manifest entries; needs skill-level ownership view and bytes FS | Medium      |
| 2   | Skill as directory unit with new manifest section (tree hash, dir backup)        | Clean ownership, one conflict per skill                                | New dir copy/restore/drift code; bigger manifest change              | Medium-High |
| 3   | Generalized Resource abstraction for all kinds                                   | Extensible                                                             | Heavy refactor of stable code; speculative                           | High        |

## Recommendation

Hybrid of 1 and 2: per-file manifest for undo/drift, per-skill tree hash for ownership and classification (create, update if owned and unchanged, skip if identical, conflict if present and not owned). Conflicts are reported in the plan and exit 2 non-interactively. Catalog layout `catalog/skills/<name>/SKILL.md` with frontmatter (name, description) validated on load; `catalog.json` `items.skills` lists names. Profiles gain `skills: []`. CLI gains `--skills <csv>`; `selectSkills` prompt shows only when the catalog has skills. One `Install` record covers both kinds.

## Risks

- Binary resources are corrupted by utf8-only `readText`/`writeAtomic`.
- Old shitaku versions cannot parse a manifest with a new kind (widen enum or bump version).
- Undo must prune only directories shitaku created and refuse when the user added files inside a skill.
- `--source` catalogs can carry path traversal, symlinks or oversized files; skills are agent instructions, so extend the README trust note.
- `applyPlan` is single-file centric; the core loop must change.
- Multi-file writes are not atomic; a crash midway leaves untracked files (journal first or clean up on failure).
- `fakePrompter`/`Prompter` literals and catalog tests need updating.
- Profiles have no CLI entry point; "profiles can reference skills" is schema-level unless `--profile` is added.

## Open Product Questions

1. Metadata location: SKILL.md frontmatter, `skills/<name>.json`, or inline in `catalog.json`? Default: frontmatter plus a names list.
2. `--force` on an existing skill? Default: replace the whole directory after backup.
3. Binary resources and limits? Default: allow via bytes API, with size and file-count limits.
4. Add `--profile` and `list` now? Default: to decide in proposal.
5. Does the single `--scope` apply to both MCPs and skills?
6. Prompt and `--yes` flow when only skills or only MCPs are chosen; is `--mcps` still required?
7. Which skill(s) does the bundled catalog ship?
8. Bump manifest version or just widen the kind?

## Ready for Proposal

Yes, after questions 1-4 are settled.
