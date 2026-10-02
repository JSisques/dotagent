# Design: Add installable skills to the catalog (issue #15)

## Technical Approach

Skills are a second kind next to MCPs. The adapter loads each skill as in-memory bytes (bounded by limits). The domain receives contents and hashes only, so it stays free of fs/os/path/process. The manifest stays per-file: each skill file is one `InstalledFile`. A domain tree hash per skill drives classification and ownership. `applyPlan` gains a separate skill path that shares the install id, the backups, and the single `Install` record. The MCP planner stays unchanged.

## Architecture Decisions

| Topic                            | Options                                                                                | Decision and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Multi-file atomicity             | journal-first (pending Install + recovery) / cleanup-on-failure / staging dir + rename | **Cleanup-on-failure.** Writes all backups first, then targets, and rolls back in-process in reverse order. The manifest is appended last. Inside each skill, `SKILL.md` is written last, so a partial skill is never loadable. A hard crash leaves an unowned directory that the next plan reports as `conflict` (never silently overwritten), plus the backups on disk. Journal-first needs a pending state machine that touches ownership, LIFO, and undo. Staging needs recursive moves and fails on EXDEV across devices. |
| Removed files (update/`--force`) | delete without record / record                                                         | Record an `InstalledFile` with `afterHash: null` (the file was deleted by the install). Undo restores it from its backup through the same code path.                                                                                                                                                                                                                                                                                                                                                                           |
| Target `removeDir`               | recursive / non-recursive                                                              | **Non-recursive `rmdir`.** shitaku can never delete user files when it prunes a directory.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Frontmatter                      | `yaml` dependency / minimal parser                                                     | **Minimal parser** for single-line `key: value` scalars, optionally quoted. Zod validates `name`/`description`. A multi-line value fails as an issue. Adds no runtime dependency.                                                                                                                                                                                                                                                                                                                                              |
| File modes                       | preserve / fixed                                                                       | Fixed `0644`. shitaku never executes skill files. Scripts run through an interpreter.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Classification                   | generalize MCP `classify` / new function                                               | New `classifySkill`, so the MCP path is untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Leak scan                        | include skills / skip                                                                  | Skip. Skills declare no env, so no resolved values flow into them.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Data Flow

    FolderCatalogSource --walkTree(guards,limits)--> SkillItem{files:bytes}
    planInit --target.skillsDir+name--> fs.listFiles/readBytes --> PresentTree
          --> buildSkillPlan(domain: treeHash, classifySkill) --> ChangePlan.skills
    applyPlan --> refresh(retree; replan; StaleFileError) --> backups --> writeBytes (SKILL.md last)
          --error--> rollback(reverse) + removeDir(createdDirs) --> rethrow
          --ok--> appendInstall(files incl. afterHash:null, createdDirs)
    undoInstall --> drift (hash != afterHash, or extra file under skill root) --> restore --> prune createdDirs (deepest first)

**Tree hash**: `sha256( join(sorted by relPath (code units), relPath + "\0" + sha256(bytes) + "\n") )`. relPath is POSIX. An absent or empty directory yields `null`.

**classifySkill(present, desired, owned, force)**: null → create; equal → skip ("already installed"); force → update ("replaced by --force"); `owned[root] === present` → update; otherwise conflict. An update writes every file of the new version and deletes every present file that is not in it.

**Undo**: drift is any recorded file whose current hash differs from `afterHash` (null means absent), plus any file under a recorded skill root that the install did not record ("added since install"). Drift refuses with exit 3. With `--force`, unknown files stay and `removeDir` skips non-empty directories. LIFO also blocks when a newer non-undone install has a skill item with the same `root`. Restore uses bytes for every file. sha256 of the bytes equals the existing text hashes for UTF-8 files.

## Interfaces / Contracts

```ts
// ports/file-system.ts (additions)
readBytes(path: string): Promise<Uint8Array | null>;
writeBytes(path: string, data: Uint8Array): Promise<void>;      // same tmp+rename as writeAtomic
listFiles(dir: string): Promise<string[] | null>;               // sorted POSIX rel paths of regular files; null if missing; throws UnsafeTreeError on symlink/special
exists(path: string): Promise<boolean>;
removeDir(path: string): Promise<boolean>;                      // rmdir; false if missing or not empty
// ports/agent-target.ts
skillsDir(scope: Scope, paths: Paths): string;                  // ~/.claude/skills | <cwd>/.claude/skills
// ports/prompter.ts
selectSkills(options: SkillItem[]): Promise<string[]>;
resolveConflict(c: { kind: 'mcp' | 'skill'; name: string; reason?: string }): Promise<'overwrite' | 'skip'>;
// domain/manifest.ts
Item = discriminatedUnion('kind', [mcp{name,action,entryHash}, skill{name,action,entryHash /*tree*/, root}]);
File.afterHash: string | null;  Install.createdDirs: string[] (default [])
deriveSkillOwnership(m): Record<root, treeHash>
// domain/catalog/limits.ts
MAX_FILE_BYTES = 1 MiB; MAX_SKILL_FILES = 100; MAX_SKILL_BYTES = 5 MiB; MAX_DEPTH = 8
```

`resolveProfile` returns `{ mcps, skills }`. `CatalogIndex.items.skills` is an array of the skill-name regex, default `[]`.

**Source guards** (`adapters/fs/walk.ts`, shared by the loader and `listFiles`): `lstat` only. A symlink or special file at any level, the root included, is an issue and the skill is skipped. A path is rejected when a segment equals `..` or contains `\` or NUL. `realpath` must stay under `<source>/skills/<name>`. Size is checked by `lstat` before reading and by length after reading. A breached limit is an issue. A target-side symlink fails planning (exit 1), even with `--force`.

## File Changes

| File                                                                                                 | Action                                        | Slice |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----- |
| `src/domain/catalog/{schema,profile}.ts`                                                             | Modify: items.skills, Profile.skills, resolve | 1     |
| `src/domain/catalog/{skill,limits}.ts`                                                               | Create: frontmatter, SkillItem, limits        | 1     |
| `src/domain/hash.ts`                                                                                 | Modify: bytes input, `treeHash`               | 1     |
| `src/ports/{file-system,catalog-source}.ts`, `src/adapters/fs/{node-fs,walk}.ts`                     | readBytes/listFiles, walk guards              | 1     |
| `src/adapters/catalog/folder-source.ts`, `catalog/catalog.json`, `catalog/skills/<example>/SKILL.md` | Load skills, bundled example                  | 1     |
| `src/ports/file-system.ts`, `src/adapters/fs/node-fs.ts`                                             | writeBytes/exists/removeDir                   | 2     |
| `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`                                    | skillsDir                                     | 2     |
| `src/domain/plan/skill-plan.ts` (create), `change-plan.ts`                                           | SkillChange, `ChangePlan.skills`              | 2     |
| `src/domain/manifest.ts`                                                                             | Item union, nullable afterHash, createdDirs   | 2     |
| `src/application/init-mcps.ts`                                                                       | planInit (skills, 2); apply + rollback (3)    | 2-3   |
| `src/application/undo-install.ts`                                                                    | Bytes, extra-file drift, pruning, root LIFO   | 3     |
| `src/ports/prompter.ts`, `src/adapters/cli/{program,clack-prompter}.ts`, `README.md`                 | `--skills`, prompts, printPlan, trust note    | 4     |

## Testing Strategy

| Layer           | What                                                                                                                     | Approach                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Unit (domain)   | frontmatter, treeHash, classifySkill, manifest parse of old and new data, profile resolve                                | Pure vitest                         |
| Unit (adapters) | walk guards (symlink, `..`, oversize, count), node-fs bytes/removeDir                                                    | Temp dirs                           |
| Application     | apply create/update/force/skip; rollback on injected write failure; undo restore, pruning, user-added refusal, `--force` | In-memory or faulty FileSystem fake |
| CLI             | `--skills`, at-least-one rule, exit 2 on conflict, skills prompt only when the catalog has skills                        | Scripted fakePrompter               |

`test/architecture.test.ts` must keep passing unchanged.

## Threat Matrix

| Boundary                           | Applicability                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Documentation-like paths           | N/A: files are copied as bytes with mode 0644 and are never executed or classified |
| Git selection / commit / push / PR | N/A: no VCS or process integration                                                 |

## Migration / Rollout

No migration. Old manifests parse (`createdDirs` defaults to `[]`, mcp items are unchanged). Reverted builds reject `skill` items and `afterHash: null`, so users must undo before downgrading. Delivery uses 4 chained PRs as in the file table.

## Open Questions

- None blocking. The limit values are design defaults and can be tuned in review.
