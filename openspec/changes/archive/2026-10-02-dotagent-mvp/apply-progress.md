# Apply Progress: dotagent-mvp

## PR1 Scaffold (tasks 1.1-1.4): DONE
Branch feat/dotagent-mvp-pr1-scaffold, base feat/dotagent-mvp. Mode: Standard (strict_tdd false).

Commits:
- b36c86b chore: scaffold project tooling and main stub (1.1, 1.4)
- test: add isolation and architecture guards (1.2, 1.3)

Work Unit Evidence:
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run` -> 1 file, 5 tests passed |
| Runtime harness | `npm run build` OK, dist/main.js keeps shebang; `npm run typecheck` OK |
| Rollback | revert the 2 commits (whole slice) |

Diff vs tracker: 173 authored lines (+1631 package-lock.json).
Deviations: added tsconfig.build.json (src-only emit; tsconfig.json noEmit covers src+test); vitest.config.ts typechecked via tsconfig include.
Remaining: PR2-PR6.

## PR2 Catalog (tasks 2.1-2.6): DONE (size over budget)
Branch feat/dotagent-mvp-pr2-catalog, base feat/dotagent-mvp-pr1-scaffold. Mode: Standard (RED tests written and seen failing before each implementation).

Commits:
- 83ff05d feat: add catalog schema and placeholder rules (2.1, 2.2)
- fe0d25a feat: add profile resolution (2.3, 2.4)
- 950664c feat: add folder catalog source and bundled catalog (2.5, 2.6)

Work Unit Evidence:
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run` -> 5 files, 27 tests passed |
| Runtime harness | N/A (no CLI yet); bundled catalog loads with 0 issues in test; `npm run typecheck` and `npm run build` OK |
| Rollback | revert the 3 commits; catalog/, src/domain/catalog, src/domain/placeholders.ts, src/ports/catalog-source.ts, src/adapters/catalog |

Diff vs PR1: 462 added lines (14 files, no lockfile change). Code+catalog 251, tests 211. Exceeds 400 budget by 62; recommend size:exception or split (schema+profile | folder source+bundled catalog).
Deviations: CatalogSource.load() returns LoadedCatalog (Catalog + issues[]) to report invalid items with file and reason; Catalog type lives in domain/catalog/schema.ts; domain avoids node:path. Profiles that fail resolution are dropped with an issue. Spec catalog.json shape clarified to items.mcps/items.profiles (user-confirmed).
Remaining: PR3-PR6.

## PR3 Plan + project write (tasks 3.1-3.6): DONE (size over budget)
Branch feat/dotagent-mvp-pr3-plan-project-write, base feat/dotagent-mvp-pr2-catalog. Mode: Standard (RED tests seen failing before each implementation).

Commits:
- 61c45eb feat: add hash and json merge (3.1)
- feat: add ports, claude-code target and atomic node fs (3.2, 3.3)
- feat: add change plan (3.4, 3.5)
- feat: add init plan and project write (3.6)

Work Unit Evidence:
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run` -> 10 files, 56 tests passed |
| Runtime harness | temp-dir apply in test/application/init-mcps.test.ts (real NodeFileSystem + bundled catalog, injected tmp Paths); typecheck and build OK |
| Rollback | revert the 4 commits (domain/hash, json-merge, plan, ports, adapters/claude-code, adapters/fs, application/init-mcps) |

Diff vs PR2 branch: 590 added lines (code 298, tests 292). Over the 400 budget by ~190; recommend size:exception (cohesive unit, tests not trimmed). Possible split if required: (3.1+3.2+3.3 foundations ~330) | (3.4-3.6 plan+init ~260).
Deviations: ChangePlan.requiredEnv is {name,set}[] (spec: report whether set) instead of string[]; buildPlan takes `existing` text and `force` (conflict->update); no `owned` update path yet (derived ownership arrives in PR4); claude-code configPath('user') throws until 4.4; FileSystem.writeAtomic creates parent dirs; added readAtPath, canonicalJson/hashEntry helpers; init exposes planInit/applyPlan/initMcps and UnknownMcpError. Unsupported targets produce action 'skip'.
Remaining: PR4-PR6.

## PR4 Safety (tasks 4.1-4.3 done; 4.4 pending): PARTIAL (stopped at budget)
Branch feat/dotagent-mvp-pr4-safety, base feat/dotagent-mvp-pr3-plan-project-write. Mode: Standard (RED tests seen failing before each implementation).

Commits:
- feat: add manifest model and ownership derivation (4.1)
- feat: add install journal (4.2)
- feat: add backup, re-read and leak scan to init apply (4.3)

Running total vs PR3 branch: 4.1 118, 4.2 182, 4.3 363 added / 21 deleted (384 changed). Next task 4.4 (~40 lines) would exceed 400, so stopped at the boundary.

Work Unit Evidence:
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run` -> 12 files, 73 tests passed |
| Runtime harness | temp-home apply in test/application/init-mcps.test.ts (real NodeFileSystem, backup byte-equality, re-read race, leak abort); typecheck and build OK |
| Rollback | revert the 3 commits (domain/manifest, application/journal, init-mcps apply, change-plan classify/replanFile) |

Deviations: ChangePlan gains declaredEnv (leak scan needs declared names); buildPlan takes `owned` (name -> hash) and has shared classify() plus replanFile(); applyPlan takes {force}; apply always writes manifest/backups under <homeDir>/.claude/.dotagent, including project scope (existing test updated: homeDir now holds only .claude); install id = compact ISO timestamp + 4 hex; manifest records only written items (create/update). Corrupt-user-file and user-scope tests land with 4.4.
Remaining: 4.4 (claude-code user scope + tests), then PR5-PR6.

## PR4 task 4.4 (user scope): DONE under size:exception (user-approved)
Commit: feat: add claude-code user scope. claudeCodeTarget.configPath('user') = <homeDir>/.claude.json; 3 user-scope tests (existing file keeps unknown keys + byte-identical backup + user scope in manifest; missing file created with only mcpServers; corrupt file untouched, no manifest). RED seen (3 failing) before the change.
Evidence: `npx vitest run` -> 12 files, 76 tests passed; typecheck and build OK. Final diff vs PR3 branch: 408 added, 25 deleted (9 files); also replaced the stale "rejects user scope" assertion in test/adapters/claude-code/target.test.ts.
PR4 complete (4.1-4.4). Remaining: PR5, PR6.

## PR5 Undo (tasks 5.1-5.2): DONE
Branch feat/dotagent-mvp-pr5-undo, base feat/dotagent-mvp-pr4-safety. Mode: Standard (RED test seen failing, module missing, before implementation).

Commit: feat: add undo install (b6f5794) - 5.1 and 5.2 together (tests never without code).
Running total vs PR4 branch: after 5.1 test 110 added; after 5.2 total 200 added / 2 deleted (code 88 incl. journal saveManifest, tests 110). Within budget.

Work Unit Evidence:
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run test/application/undo-install.test.ts` -> 8 tests passed; full `npx vitest run` -> 13 files, 84 tests passed |
| Runtime harness | temp-home init apply then undo (real NodeFileSystem): project and user scope restore byte-equal original; typecheck and build OK |
| Rollback | revert the commit (undo-install.ts, journal saveManifest) |

Design: undoInstall(deps{fs,paths,now?}, {id?,force?,dryRun?}) -> {status: nothing|already-undone|dry-run|refused|undone, exitCode 0|3, installId, files, changed}. Throws UndoSelectionError (unknown id, or LIFO blocked by newer non-undone install of same file) and UndoVerifyError (missing backup or restored hash != beforeHash). All hashes checked before any write. CLI (PR6) maps refused -> exit 3, UndoSelectionError -> non-zero.
Deviations: journal.ts gained saveManifest (appendInstall reuses it). No `--id` newest-only message in CLI yet (PR6).
Remaining: PR6 (6.1-6.5).

## PR6 CLI (tasks 6.1-6.3 done; 6.4 pending; 6.5 skipped by instruction): PARTIAL (stopped at budget)
Branch feat/dotagent-mvp-pr6-cli, base feat/dotagent-mvp-pr5-undo. Mode: Standard (RED test seen failing, module missing, before program.ts).

Commits:
- b596bcb feat: add clack prompter (6.1)
- e193a73 feat: add cli program (6.2 + 6.3 together, tests never without code)

Running total vs PR5 branch: after 6.1 75 added; after 6.2+6.3 479 added (code 249, tests 230). The budget was crossed inside 6.3 (the test and program cannot be split); stopped before 6.4 (main.ts wiring + README, ~50 lines more).

Work Unit Evidence (so far):
| Evidence | Value |
|---|---|
| Focused test | `npx vitest run test/adapters/cli` -> 23 tests passed; full `npx vitest run` -> 14 files, 107 tests passed |
| Runtime harness | in-process runCli with real NodeFileSystem + bundled catalog in temp dirs (init/undo/dry-run/leak); typecheck and build OK. Built binary check pending with 6.4 (main.ts still a stub) |
| Rollback | revert the 2 commits |

Design: runCli(argv, CliDeps{makeSource(folder?), fs, target, paths, env, prompter, out, err, now?}) -> exit code. Flag-only (--mcps+--scope) or --yes = non-interactive (no prompts); --yes without both flags -> 1. Conflicts: non-interactive without --force -> exit 2, nothing written; interactive -> per-conflict prompt (skip drops the item, overwrite replans with force). Catalog load failures (incl. SyntaxError) -> "cannot load catalog from <where>: ..." exit 1. Expected errors (UnknownMcp, Stale, Leak, Config, Undo*, PromptCancelled) -> exit 1. Undo refused -> 3.
Deviations: flag-only conflicts abort the whole install with exit 2 (design) rather than skipping that entry (spec wording); dry-run with conflicts in non-interactive mode also exits 2.
Remaining: 6.4 (main.ts wiring, README usage, --source trust note, Known limitation note); 6.5 left [ ] on purpose (must not touch real home).

## PR6 task 6.4: DONE under size:exception (user-approved)
Commits: feat: wire cli entrypoint (src/main.ts), docs: add usage (README usage, exit codes, --source trust note, Known limitation on ${VAR} in user-scope ~/.claude.json). Spec mcp-install conflict scenario aligned: non-interactive without --force aborts the whole install, writes nothing, exit 2.
Final diff vs PR5 branch: 534 added, 4 deleted (6 files). Evidence: `npx vitest run` -> 14 files, 107 tests passed; typecheck and build OK; built binary: `node dist/main.js --help` lists init/undo; `init --mcps github --scope user --dry-run` with HOME and cwd in a temp dir exits 0, prints the plan and leaves temp home/cwd empty (real home untouched).
6.5 left [ ] on purpose. PR6 complete except 6.5 (manual, requires real home).
