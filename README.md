# dotagent

Portable, configurable AI agent setup (skills, MCPs, etc.) installable via `npx @jsisques/dotagent`.

The binary is named `dotagent-cli` to avoid clashing with the unscoped `dotagent` package.

## Usage

```sh
# Interactive: pick MCPs and scope, review the plan, confirm
npx @jsisques/dotagent init

# Non-interactive: no prompts
dotagent-cli init --mcps github,context7 --scope project

# Preview only: prints the plan, writes nothing (no backups, no manifest)
dotagent-cli init --mcps github --scope user --dry-run

# Restore the files changed by the last install
dotagent-cli undo [--id <id>] [--force] [--dry-run]
```

Scopes: `project` writes `./.mcp.json`, `user` writes `~/.claude.json` (close Claude Code first).

Flags for `init`: `--mcps <a,b>`, `--scope project|user`, `--source <folder>`, `--dry-run`, `--yes` (skip confirmation, needs `--mcps` and `--scope`), `--force` (overwrite entries that differ).

Exit codes: `0` ok, `1` error, `2` unresolved conflicts (an existing entry with the same name differs; re-run with `--force`), `3` undo refused because a file changed since the install (use `--force`).

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Before changing a file, dotagent backs it up under `~/.claude/.dotagent/backups/` and records the install in `~/.claude/.dotagent/manifest.json`.

### Custom catalogs and trust

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries in a catalog are written to your config and Claude Code executes their `command` later. Only use folders you trust.

### Known limitation

Whether `${VAR}` placeholders are expanded in user-scope `~/.claude.json` entries is unverified. For entries with env placeholders (for example `github`), prefer project scope (`.mcp.json`).

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm run format        # rewrite files with Prettier
npm run format:check  # fail if any file is not formatted
```

Tests never touch the real home directory; see `test/setup.ts`.

Contributors need Node `>=22.22.1` (`nvm use` reads `.nvmrc`). Git hooks are installed by `npm install` (via Husky):

| Hook         | Runs                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `pre-commit` | Prettier on staged files (lint-staged)                                                              |
| `commit-msg` | commitlint with Conventional Commits                                                                |
| `pre-push`   | `npm run typecheck`, `npm run test:changed` (only tests affected vs `origin/main`), `npm run build` |

Bypass hooks with `git commit --no-verify`, `git push --no-verify`, or `HUSKY=0`.
