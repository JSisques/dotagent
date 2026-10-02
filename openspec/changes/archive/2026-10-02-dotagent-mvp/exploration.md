# Exploration: dotagent-mvp

## Current State
Greenfield. README only; no package.json, no tests. `openspec/config.yaml` has strict_tdd=false until Vitest exists.

## Claude Code config locations (sources: code.claude.com/docs mcp, settings, skills, hooks, claude-directory)
| Thing | Location / format |
|---|---|
| MCP, user scope | `~/.claude.json`, top-level `mcpServers` (NOT `~/.claude/settings.json`) |
| MCP, local scope | `~/.claude.json` -> `projects["<abs path>"].mcpServers` |
| MCP, project scope | `./.mcp.json` `{ "mcpServers": {...} }`, committed |
| Official write path | `claude mcp add-json <name> '<json>' --scope user\|project\|local` |
| Env expansion | `${VAR}` / `${VAR:-default}` documented for `.mcp.json` (unverified for `~/.claude.json`) |
| Skills | `~/.claude/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md` |
| Commands | Same mechanism as skills now; skills recommended |
| Hooks | `settings.json` (user/project/local), `hooks.<Event>[{matcher, hooks:[...]}]` |
| Instructions | `~/.claude/CLAUDE.md`, `./CLAUDE.md` or `./.claude/CLAUDE.md` |

`~/.claude.json` is app-owned and written live by Claude Code (backups in `~/.claude/backups/`). High-risk to edit.

## Naming
Unscoped npm `dotagent` (johnlindquist, v2.10.0) syncs rule files across editors; it does not install MCPs/skills from a catalog. Same bin name `dotagent`. Also `@iannuttall/dotagents`. Verdict: no registry conflict (scope), moderate confusion/bin-clash risk.

## Forks
1. Agent scope: Claude-only behind an `AgentTarget` port (recommended) vs multi-agent day one (3x format surface: JSON, TOML, MDC).
2. MCP write strategy: direct JSON merge vs shell out to `claude mcp` vs hybrid (project -> `.mcp.json` direct; user -> `~/.claude.json` merge + mandatory backup + atomic write). Recommended: hybrid.
3. Catalog format: per-item files + zod; JSON (zero dep, same as targets) vs YAML (comments).
4. Secrets: catalog stores env references only; writer emits `${VAR}` placeholders; never write literals.
5. CLI libs: commander + @clack/prompts (prompts behind a `Prompter` port).
6. Source: bundled catalog + `--source <folder>` in MVP; `giget` github source later behind `CatalogSource` port; remote catalogs are a trust boundary.
7. Safety: plan/apply split (`ChangePlan`), manifest with content hashes, backups, atomic writes, `--dry-run`, undo.
8. Tests: injected `homeDir`/`cwd` via a `Paths` object; never call `os.homedir()` outside the composition root.

## Draft catalog structure
```
catalog/
  catalog.json
  mcps/<name>.json
  skills/<name>/SKILL.md
  instructions/<name>.md   (post-MVP)
  hooks/<name>.json        (post-MVP)
  profiles/<name>.json     (supports "extends")
```
Manifest on user machine: `~/.claude/.dotagent/manifest.json`; backups in `~/.claude/.dotagent/backups/`.

## Risks
- `~/.claude.json` live-write race; user requirement says `~/.claude/` but user-scope MCP lives in sibling `~/.claude.json`.
- Name/bin proximity to existing `dotagent`.
- Remote catalogs execute code (hooks, stdio MCP commands).
- `${VAR}` expansion unverified for user-scope entries.
- Hook array ownership (post-MVP).

## Ready for Proposal
Yes, after the user approves the catalog structure and forks.
