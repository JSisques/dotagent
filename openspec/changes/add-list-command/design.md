# Design: Add a `list` command to browse the catalog (issue #54)

## Technical Approach

Mirror `status`: a pure domain module builds, filters and sorts entries; a thin application use case loads the catalog through `CatalogSource` and returns a report; `program.ts` registers `list` and renders text or JSON. No new port, no `src/main.ts` change, no filesystem access.

## Architecture Decisions

| Decision      | Choice                 | Rejected                 | Rationale                                |
| ------------- | ---------------------- | ------------------------ | ---------------------------------------- |
| Domain module | `listing.ts` in domain | Matcher-only `search.ts` | Selection logic stays pure and fake-free |
| Entry kind    | Singular in JSON       | Plural kinds             | Matches `status --json`                  |
| Sort order    | Kind, then name        | Fixed kind order         | Literal, locale-free, like `status`      |
| Search target | Name + collapsed text  | Raw description          | Users search what text mode shows        |
| Load failure  | `CatalogLoadError`     | Extend `guarded()`       | `<where>` is CLI knowledge               |
| Invalid kind  | Commander choices      | Manual check             | Prints allowed choices; exit 1           |
| Name column   | Global max width       | Per-group width          | One stable column                        |

- Entry kinds are `mcp`, `profile`, `skill`; CLI choices stay plural (`mcps|skills|profiles`), no aliases.
- Sorting compares code units (like `status`): kind first, so group order is `mcp`, `profile`, `skill`; then name.
- Search: `query.toLowerCase()` is a substring of the lowercased name or the lowercased, whitespace-collapsed description. Empty query matches all.
- Load failure: the use case wraps a `source.load()` rejection in `CatalogLoadError` (original message). `runList` catches only that class and prints `error: cannot load catalog from <where>: <msg>` (exit 1); unknown errors still propagate through `guarded()`.
- Invalid kind: `new Argument('[kind]').choices(LIST_KINDS)`. Under `exitOverride()`, commander throws `CommanderError` (`commander.invalidArgument`, exit code 1); `runCli` already returns `e.exitCode`, and the message reaches `deps.err` via `configureOutput`.
- `runList` repeats `opts.source ?? 'the bundled catalog'`; extracting a shared helper from `runInit` is out of scope.

## Data Flow

    argv ──> commander (choices check) ──> runList
                                             │ deps.makeSource(opts.source)
                                             v
                                listCatalog(deps, {kind, search})
                                  │ source.load()  (reject -> CatalogLoadError)
                                  v
                       listEntries(catalog, {kind, search})  [domain]
                                  v
                    { items, issues } ──> issues -> deps.err (warnings)
                                          items  -> text or JSON -> deps.out

## Interfaces / Contracts

```ts
// src/domain/catalog/listing.ts
export const LIST_KINDS = ['mcps', 'skills', 'profiles'] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export type EntryKind = 'mcp' | 'profile' | 'skill';
export interface CatalogEntry {
  kind: EntryKind;
  name: string;
  description: string | null;
}
export function collapseWhitespace(text: string): string; // /\s+/g -> ' ', trimmed
export function listEntries(catalog: Catalog, req: { kind?: ListKind; search?: string }): CatalogEntry[];

// src/application/list-catalog.ts
export interface ListDeps {
  source: CatalogSource;
}
export interface ListReport {
  items: CatalogEntry[];
  issues: CatalogIssue[];
}
export class CatalogLoadError extends Error {}
export function listCatalog(deps: ListDeps, req: { kind?: ListKind; search?: string }): Promise<ListReport>;
```

A profile without `description` maps to `null`. JSON keeps raw descriptions; text collapses them.

CLI (`program.ts`): `const LIST_JSON_VERSION = 1;` plus command `list` with `addArgument(new Argument('[kind]', ...).choices(LIST_KINDS))`, `--search <text>`, `--source <folder>`, `--json`, and action `(kind, opts) => exitCode = await guarded(deps, () => runList(deps, kind, opts))`.

`runList` prints each issue as `warning: skipped <file>: <reason>` to stderr in both modes, then:

- JSON: `JSON.stringify({ version: LIST_JSON_VERSION, items }, null, 2)`; an empty result gives `items: []`.
- Text (`printList`): an empty result prints `no matching items`. Otherwise one `${kind}s:` header per non-empty group, then `  ${name.padEnd(width)}  ${description}`; a null or empty description prints `  ${name}` with no trailing spaces.

## File Changes

| File                                    | Action | Description                                          |
| --------------------------------------- | ------ | ---------------------------------------------------- |
| `src/domain/catalog/listing.ts`         | Create | Entry model, filter, search, sort, collapse          |
| `src/application/list-catalog.ts`       | Create | `listCatalog`, `CatalogLoadError`, `ListReport`      |
| `src/adapters/cli/program.ts`           | Modify | `list` command, `runList`, `printList`, JSON version |
| `test/domain/catalog/listing.test.ts`   | Create | Pure selection tests                                 |
| `test/application/list-catalog.test.ts` | Create | Fake-source use case tests                           |
| `test/adapters/cli/program.test.ts`     | Modify | `describe('list')` end-to-end via `runCli`           |
| `README.md`                             | Modify | Usage line, `### List` section, JSON shape           |

## Testing Strategy (strict TDD order)

| Step | Layer       | RED test                                  |
| ---- | ----------- | ----------------------------------------- |
| 1    | CLI         | Pin invalid kind exit code                |
| 2    | Domain      | Selection, search, sort, null description |
| 3    | Application | Issues passthrough, `CatalogLoadError`    |
| 4    | CLI         | Grouped text, filter, search, empty       |
| 5    | CLI         | JSON document and stderr warnings         |
| 6    | CLI         | Load failure, duplicate names, no writes  |

1. `list bogus` returns 1, stderr contains `Allowed choices`, stdout empty. Fails first (unknown command also exits 1, so also assert the choices text).
2. All three kinds mapped; kind then name order; kind filter; case-insensitive search on name and on description; missing profile description is `null`; `collapseWhitespace`.
3. Fake `CatalogSource` returns items and issues; a rejected `load()` becomes `CatalogLoadError` carrying the original message.
4. Exact `out` lines from a custom `--source` fixture (aligned column, name-only profile, multi-line description collapsed); kind filter; `--search`; `no matching items` with exit 0. One bundled-catalog smoke test asserts structure only.
5. `--json`: one document, `version: 1`, sorted, `description: null`, empty `items: []`; a skipped entry warns on stderr while stdout stays parseable.
6. Missing folder and malformed `catalog.json` exit 1 naming the folder; a name used by both an MCP and a skill appears in both groups; `tmp.cwd` and `tmp.homeDir` stay empty.

## Architecture Guards

Domain imports only `@/domain/catalog/schema.js` types; application imports domain and ports only; no `fs`, `process` or `../` specifiers; `@/` aliases with `.js` extensions.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Confirm with the spec that JSON `kind` values are singular and group order is `mcp`, `profile`, `skill`.
