# Exploration: add-list-command (issue #54)

## Current state

- `src/adapters/cli/program.ts` registers `init`, `undo`, `status` via commander; each action is `exitCode = await guarded(deps, () => runX(deps, opts))`; output via `deps.out` / `deps.err`.
- `CliDeps.makeSource(folder?)` (built in `src/main.ts`) returns a `FolderCatalogSource` for the bundled catalog or `--source <folder>`. `--source` is declared per command.
- `CatalogSource.load()` returns `{ mcps, skills, profiles, issues }`; rejects on missing/invalid `catalog.json`; per-item problems become `issues`; invalid skills/profiles are dropped.
- Descriptions: MCP and skill required; profile optional.
- `status` prints catalog issues to stderr (`warning: skipped <file>: <reason>`) in both modes; `status --json` is `{ version, ... }` pretty-printed.
- `init` hard-fails on load error (`error: cannot load catalog from <where>: <msg>`, exit 1); `status` swallows it (not suitable for `list`).
- Architecture guards: no `../` imports, domain is pure, `homedir` only in `main.ts`.

## Approaches

1. Use case + thin CLI printer, mirroring `status` (recommended). No port or `main.ts` change.
2. Everything inline in `program.ts`: worse layering and testability.
3. New query method on `CatalogSource` port: widens the port for a non-I/O concern.

## Affected areas

- `src/adapters/cli/program.ts`, new `src/application/list-catalog.ts`, optional pure `src/domain/catalog/search.ts`.
- Tests: `test/application/list-catalog.test.ts`, `describe('list')` in `test/adapters/cli/program.test.ts`.
- `README.md`: Usage line + `### List` section.

## Confirmed decisions

See Engram `sdd/add-list-command/pre-proposal`: positional `[kind]`; case-insensitive substring search over name and description; grouped plain output; empty = exit 0; JSON `{version:1, items:[{kind,name,description|null}]}` sorted by kind then name; load failure exits 1.

## Risks

- Profile description may be null/missing.
- `--json` stdout must stay pure JSON (warnings to stderr).
- Invalid kind exit code under `exitOverride` unverified.
- Multi-line descriptions may need whitespace collapsing in text mode.
- Same name may exist as both MCP and skill: always show kind.
- Strict TDD: tests first, bundled and custom catalogs.
