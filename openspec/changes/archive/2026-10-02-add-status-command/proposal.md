# Proposal: Add a `status` command listing installed items (issue #45)

## Intent

Users cannot see what shitaku installed, where, or whether it drifted. A read-only `shitaku status` reports every active, shitaku-managed item and its state. It is also the groundwork for future `update` and `doctor` commands.

## Scope

### In Scope

- `shitaku status` (no alias). Read-only: no writes to configs, skills, or the manifest.
- Manifest-driven: only items from installs with `undoneAt === null`. Both scopes by default; `--scope project|user` filters.
- Kinds `mcp` and `skill`. The report model keeps `kind` open for a future third kind. The header shows the agent target.
- States: `installed`, `modified` (also wins over out of date), `out-of-date` (catalog hash differs from installed hash), `missing` (absent on disk), `missing-from-catalog`.
- `--source` as in `init`. A catalog load failure degrades to a `catalog unavailable` mode (catalog-dependent states reported as unknown) instead of aborting.
- `--json`: versioned public contract with `version`, `target`, and per item `scope`, `kind`, `name`, `state`, `path`, `installId`.
- Graceful handling: corrupt manifest gives a clear error, and unsafe or unreadable skill trees are reported per item.
- Exit code 0 on success. README documents the command and its JSON shape.

### Out of Scope

- "Agents" as a catalog kind, plus its install path.
- Scanning unmanaged disk items and listing available catalog items.
- `--check` or non-zero drift exit codes. Per-item versions. Manifest schema changes.

## Capabilities

### New Capabilities

- `install-status`: status report, states, scope filter, degraded catalog mode, text and versioned JSON output, exit code.

### Modified Capabilities

- None.

## Approach

- **Domain**: a pure `classifyStatus(owned, current, desired)` that mirrors `classify`/`classifySkill`, plus an ownership derivation that keeps `installId` (`deriveOwnership` drops it today).
- **Application**: `src/application/status.ts` reads the manifest, current disk (config entry via `hashEntry`, skill tree via `treeHash`), and the optional catalog. It returns a report model. `readPresent` moves out of `init-mcps.ts` into a shared helper. No new port.
- **CLI**: a `status` command in `program.ts` with text and JSON renderers, wrapped in `guarded()`.

| Layer       | Paths                                                        | Impact       |
| ----------- | ------------------------------------------------------------ | ------------ |
| domain      | `src/domain/manifest.ts`, `src/domain/plan/status-plan.ts`   | Modified/New |
| application | `src/application/status.ts`, `init-mcps.ts` (helper extract) | New/Modified |
| adapters    | `src/adapters/cli/program.ts`                                | Modified     |
| docs/tests  | `README.md`, `test/**`                                       | New/Modified |

## Risks

| Risk                                                     | Likelihood | Mitigation                                               |
| -------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| JSON contract frozen too early                           | Med        | `version` field; additive changes only                   |
| `--source` installs reported against the default catalog | Med        | Document it; degraded/unknown when the catalog is absent |
| Claude Code rewrites `~/.claude.json`                    | Low        | Compare entry hash by name, not the whole file           |
| Same MCP name in both scopes                             | Low        | Key items by scope + config path + name                  |

## Rollback Plan

Revert the slice PRs in reverse order. The command is read-only and needs no data migration or manifest change, so no user-side action is required.

## Review Workload Forecast

Estimated 650-850 changed lines, including tests (strict TDD). This exceeds the 400-line budget. Chained PRs recommended:

1. Domain classifier, installId-aware ownership, and `readPresent` extract, with tests.
2. Application `status` use case: scopes, states, degraded catalog, corrupt manifest, with tests.
3. CLI command, text and JSON renderers, and README.

## Success Criteria

- [ ] Tests cover installed, modified, missing, out-of-date, missing-from-catalog, and undone exclusion.
- [ ] `--json` emits the versioned shape. `--scope` filters. Exit code is 0.
- [ ] A catalog failure degrades without aborting.
- [ ] No filesystem writes during `status`.
- [ ] Typecheck, lint, build, and `pnpm test` pass. README updated.
