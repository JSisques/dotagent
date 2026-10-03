# Proposal: Add a `list` command to browse the catalog (issue #54)

## Intent

Users cannot see which MCPs, skills, and profiles a catalog offers without reading `catalog/` by hand. A read-only `shitaku list` shows available items, with optional kind filtering, search, and a machine-readable output.

## Scope

### In Scope

- `shitaku list [kind]`: positional `kind` is one of `mcps|skills|profiles`; no singular aliases; an invalid kind fails through commander choices; no kind lists all three.
- `--search <text>`: case-insensitive substring match over name AND description.
- Plain output grouped by kind with a header and an aligned name column; a profile without a description prints its name only.
- Empty result: exit 0, text `no matching items`, JSON `items: []`.
- `--json`: `{ "version": 1, "items": [{ "kind", "name", "description" | null }] }`, flat, sorted by kind then name.
- Catalog warnings go to stderr in both modes.
- `--source <folder>` honored. Load failure prints `error: cannot load catalog from <where>: <msg>` and exits 1 (like `init`).
- README documents the command and its JSON shape (additive changes only, like `status`).

### Out of Scope

- Installed state per item (that is `status`).
- Fuzzy, regex, or field-specific search; pagination; colors.
- New ports or `src/main.ts` changes.

## Capabilities

### New Capabilities

- `catalog-list`: kind filter, search, grouping and sorting, text and versioned JSON output, empty result, warnings, load failure, exit codes.

### Modified Capabilities

- None.

## Approach

Exploration approach 1: application use case plus thin commander printer, mirroring `status`.

- **Domain** (optional): pure search/match helper.
- **Application**: `src/application/list-catalog.ts` loads via `CatalogSource`, filters, sorts, and returns a report model plus issues.
- **CLI**: `list` command in `program.ts`, wrapped in `guarded()`, with text and JSON renderers.

| Layer       | Paths                                         | Impact       |
| ----------- | --------------------------------------------- | ------------ |
| domain      | `src/domain/catalog/search.ts` (optional)     | New          |
| application | `src/application/list-catalog.ts`             | New          |
| adapters    | `src/adapters/cli/program.ts`                 | Modified     |
| docs/tests  | `README.md`, `test/application/**`, CLI tests | New/Modified |

## Risks

| Risk                                         | Likelihood | Mitigation                                     |
| -------------------------------------------- | ---------- | ---------------------------------------------- |
| JSON contract frozen too early               | Med        | `version` field; additive changes only         |
| `--json` stdout polluted by warnings         | Low        | Warnings always to stderr; test it             |
| Invalid-kind exit code under `exitOverride`  | Med        | Pin with a CLI test before implementing        |
| Multi-line descriptions break text alignment | Low        | Collapse whitespace in text mode               |
| Same name as MCP and skill                   | Low        | Always show kind (group header / `kind` field) |

## Rollback Plan

Revert the PR(s). The command is read-only, touches no manifest, config, or port, so no user-side action is required.

## Review Workload Forecast

Estimated 300-450 changed lines including tests (strict TDD). Near the 400-line budget: a single PR is likely; if it exceeds, chain (1) use case + tests, (2) CLI + README.

## Success Criteria

- [ ] Tests cover all kinds, kind filter, search on name and description, empty result, null profile description, warnings on stderr, and load failure exit 1.
- [ ] `--json` emits the versioned, sorted shape.
- [ ] No filesystem writes during `list`.
- [ ] Typecheck, lint, format check, build, and `pnpm test` pass. README updated.
