# Proposal: dotagent MVP (catalog + `init` for MCPs)

## Intent
Developers hand-copy MCP configs between machines and projects. `@jsisques/dotagent` installs curated agent config from a catalog safely: reversible, secret-free, and previewable. **Gate**: the catalog structure below is approved before any code is written.

## Scope
### In Scope
- Catalog schema (JSON per-item files, zod-validated) plus a bundled catalog and `--source <folder>`
- `dotagent-cli init`: pick MCPs, then write to project `./.mcp.json` or user `~/.claude.json`
- `--dry-run`, backups, manifest `~/.claude/.dotagent/manifest.json`, undo path
- Secrets stored only as `${VAR}` placeholders, never as literals

### Out of Scope (later changes)
- `list/add/remove/sync`, skills, instructions, commands, hooks, applying profiles
- Remote/GitHub sources (giget), and agents other than Claude Code

## Catalog Structure
```
catalog/
  catalog.json            # index: version, items
  mcps/<name>.json
  profiles/<name>.json    # supports "extends"
  skills/ instructions/ hooks/   # reserved, post-MVP
```
```json
// mcps/github.json
{ "name": "github", "description": "GitHub MCP",
  "server": { "type": "http", "url": "https://api.githubcopilot.com/mcp/",
    "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" } },
  "env": [{ "name": "GITHUB_TOKEN", "required": true }],
  "targets": ["claude-code"] }
```
```json
// profiles/web.json
{ "name": "web", "extends": ["base"], "mcps": ["github", "context7"] }
```
`targets` is optional; the schema stays agent-neutral. YAML was rejected because it adds a dependency and uses a different format from the target files.

## Capabilities
### New Capabilities
- `catalog`: schema, loading, validation, profile `extends`
- `mcp-install`: `init` flow, scope selection, plan/apply, JSON merge
- `install-safety`: dry-run, backup, atomic write, manifest, undo, secret placeholders

### Modified Capabilities
None

## Approach
- Hexagonal. Domain: `ChangePlan`, catalog model. Ports: `AgentTarget`, `CatalogSource`, `Prompter`, `FileSystem`, `Paths`. Adapters: Claude Code target, bundled/folder sources, commander + @clack/prompts.
- Hybrid write. Project scope writes `./.mcp.json` directly. User scope merges into `~/.claude.json`, which sits next to `~/.claude/` and is not inside it. The merge takes a mandatory backup, re-reads the file before writing, and writes atomically (tmp file, then rename).
- TypeScript ESM on Node LTS; Vitest with injected `homeDir`/`cwd`, so tests never touch the real `~`.
- Bin name `dotagent-cli`, chosen to avoid clashing with the unscoped `dotagent` package. It is easy to change, and the README explains the difference. `publishConfig.access=public`.

## Affected Areas
| Area | Impact | Layer |
|---|---|---|
| `src/domain/` | New | Domain |
| `src/ports/` | New | Ports |
| `src/adapters/{claude-code,catalog,cli,fs}/` | New | Adapters |
| `src/main.ts` | New | Composition root |
| `catalog/` | New | Data |
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md` | New/Modified | Tooling |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Race with Claude Code writing `~/.claude.json` live | Med | Re-read before write, atomic rename, backup, warn to close Claude |
| `${VAR}` expansion in user scope is unverified | Med | Verify manually before release; document it; prefer project scope |
| Bin/concept confusion with `dotagent` | Low | Distinct bin, README note |

## Rollback Plan
- Runtime: `undo` restores the files listed in the manifest from `~/.claude/.dotagent/backups/` and checks content hashes first. Restoring a backup by hand also works.
- Code: revert the PRs. This is greenfield, so nothing depends on it.

## Review Workload Forecast
- 400-line budget risk: High. Delivery: ask-on-risk, using chained PRs.
- Slices: (1) scaffold + tooling; (2) catalog schema + loader + bundled catalog; (3) planning + project `.mcp.json` writer; (4) user `~/.claude.json` merge + backup/manifest/undo; (5) `init` CLI + prompts.

## Success Criteria
- [ ] The catalog structure is approved before coding starts
- [ ] `init --dry-run` prints the plan and writes nothing
- [ ] Project and user writes merge without losing any existing keys
- [ ] `undo` restores the original bytes
- [ ] No secret literal is ever written, and tests confirm this
- [ ] The test suite never touches the real home directory
