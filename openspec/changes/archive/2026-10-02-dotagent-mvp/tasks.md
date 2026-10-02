# Tasks: dotagent MVP (catalog + init for MCPs)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,000 total; 150-340 per PR |
| 400-line budget risk | High (single PR); Low-Medium per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR1 scaffold, PR2 catalog, PR3 plan+project write, PR4 safety, PR5 undo, PR6 CLI |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Per-slice lines: PR1 ~170, PR2 ~380 (tight), PR3 ~390 (tight), PR4 ~300, PR5 ~220, PR6 ~360.

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|------|------|----|--------------|-----------------|----------|
| 1 | Tooling + guards | PR1 | `npx vitest run test/architecture.test.ts` | `npm run build` | whole slice |
| 2 | Catalog load/validate | PR2 | `npx vitest run test/domain test/adapters/catalog` | N/A, no CLI yet | catalog files |
| 3 | Plan + project write | PR3 | `npx vitest run test/domain test/application/init-mcps.test.ts` | temp-dir apply | plan/fs/target |
| 4 | User scope, backup, manifest | PR4 | `npx vitest run test/application` | temp-home apply | manifest/journal |
| 5 | Undo | PR5 | `npx vitest run test/application/undo-install.test.ts` | temp-home undo | undo-install.ts |
| 6 | CLI wiring | PR6 | `npx vitest run test/adapters/cli` | `node dist/main.js init --dry-run` | cli/ + main.ts |

Chain note: if feature-branch-chain, PR1 base = tracker; PRn base = PR(n-1).

## PR1: Scaffold (feat: scaffold)

- [x] 1.1 `package.json`, `tsconfig.json`, `.gitignore`: package essentials, scripts, deps
- [x] 1.2 `vitest.config.ts`, `test/setup.ts` (mock `node:os` homedir throws, HOME to temp), `test/helpers/tmp-paths.ts` [install-safety: Test isolation]
- [x] 1.3 `test/architecture.test.ts`: no fs/os/process in `src/domain`; `homedir` only in main.ts
- [x] 1.4 `src/main.ts` stub with shebang; README note

## PR2: Catalog (feat: catalog loading)

- [x] 2.1 RED `test/domain/catalog/schema.test.ts` [Valid item, Invalid item, Literal secret]
- [x] 2.2 `src/domain/placeholders.ts`, `src/domain/catalog/schema.ts`
- [x] 2.3 RED `test/domain/catalog/profile.test.ts` [Extends, Cycle `a -> b -> a`, Unknown ref]
- [x] 2.4 `src/domain/catalog/profile.ts`
- [x] 2.5 `src/ports/catalog-source.ts`, `src/adapters/catalog/folder-source.ts`; test [Reserved folders, Custom folder, Missing source, invalid item skipped]
- [x] 2.6 `catalog/catalog.json`, `catalog/mcps/{github,context7}.json`, `catalog/profiles/{base,web}.json`

## PR3: Plan + project write (feat: init plan)

- [x] 3.1 `src/domain/hash.ts`, `src/domain/json-merge.ts`; RED test [Unknown keys kept, corrupt abort, indent]
- [x] 3.2 `src/ports/{agent-target,file-system,paths}.ts`, `src/adapters/claude-code/target.ts` (project scope, targets filter)
- [x] 3.3 `src/adapters/fs/node-fs.ts` atomic write; test [Write failure]
- [x] 3.4 RED `test/domain/plan/change-plan.test.ts` [Identical, Same name differs, Missing env var]
- [x] 3.5 `src/domain/plan/change-plan.ts`
- [x] 3.6 `src/application/init-mcps.ts` plan+apply (no backup); test [Project scope, Missing file, dry-run]

## PR4: Safety (feat: backup, manifest, user scope)

- [x] 4.1 RED `test/domain/manifest.test.ts`; `src/domain/manifest.ts` (deriveOwnership)
- [x] 4.2 `src/application/journal.ts`; test [Manifest written, No manifest]
- [x] 4.3 Backup + re-read/re-plan + leak scan in `src/application/init-mcps.ts` [Backup taken, Claude wrote meanwhile, Placeholder only, Unmanaged same name, Corrupt user file]
- [x] 4.4 User scope in `src/adapters/claude-code/target.ts` [User scope, Missing user file]

## PR5: Undo (feat: undo-install)

- [x] 5.1 RED `test/application/undo-install.test.ts` [Clean undo byte-equal, Changed since install, No manifest, LIFO]
- [x] 5.2 `src/application/undo-install.ts` (`--id`, `--force`, `--dry-run`, exit 3)

## PR6: CLI (feat: cli)

- [x] 6.1 `src/ports/prompter.ts`, `src/adapters/cli/clack-prompter.ts`
- [x] 6.2 RED `test/adapters/cli/program.test.ts` [Interactive, Non-interactive, Unknown MCP, Dry run, `--yes` conflict exit 2, `--force`, leak test]
- [x] 6.3 `src/adapters/cli/program.ts` (`runCli(argv, deps)`: init, undo, `--source`)
- [x] 6.4 Wire `src/main.ts`; README usage + `--source` trust note
- [ ] 6.5 Manual check: `${VAR}` expansion in `~/.claude.json` (design open question)
