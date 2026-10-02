# shitaku

Portable, configurable AI agent setup (skills, MCPs, etc.) installable via `npx @jsisques/shitaku`.

## Usage

```sh
# Interactive: pick MCPs and scope, review the plan, confirm
npx @jsisques/shitaku init

# Non-interactive: no prompts
shitaku init --mcps github,context7 --scope project

# Preview only: prints the plan, writes nothing (no backups, no manifest)
shitaku init --mcps github --scope user --dry-run

# Restore the files changed by the last install
shitaku undo [--id <id>] [--force] [--dry-run]
```

Scopes: `project` writes `./.mcp.json`, `user` writes `~/.claude.json` (close Claude Code first).

Flags for `init`: `--mcps <a,b>`, `--scope project|user`, `--source <folder>`, `--dry-run`, `--yes` (skip confirmation, needs `--mcps` and `--scope`), `--force` (overwrite entries that differ).

Exit codes: `0` ok, `1` error, `2` unresolved conflicts (an existing entry with the same name differs; re-run with `--force`), `3` undo refused because a file changed since the install (use `--force`).

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Before changing a file, shitaku backs it up under `~/.claude/.shitaku/backups/` and records the install in `~/.claude/.shitaku/manifest.json`.

### Custom catalogs and trust

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries in a catalog are written to your config and Claude Code executes their `command` later. Only use folders you trust.

### Known limitation

Whether `${VAR}` placeholders are expanded in user-scope `~/.claude.json` entries is unverified. For entries with env placeholders (for example `github`), prefer project scope (`.mcp.json`).

## Development

```sh
pnpm install
pnpm run typecheck
pnpm run lint          # ESLint (typescript-eslint, type-aware); `lint:fix` applies autofixes
pnpm test
pnpm run build
pnpm run format        # rewrite files with Prettier
pnpm run format:check  # fail if any file is not formatted
```

This project uses pnpm, pinned through the `packageManager` field. Run `corepack enable` once so the pinned version is used automatically (Node 25+ no longer bundles Corepack: run `npm i -g corepack` first). Without Corepack, `npm i -g pnpm@10` also works. If a global pnpm is already installed, skip Corepack (or remove the global pnpm first), because installing Corepack globally can conflict with its binary. `npm install` is not supported for development.

Tests never touch the real home directory; see `test/setup.ts`.

Contributors need Node `>=22.22.1` (`nvm use` reads `.nvmrc`). Git hooks are installed by `pnpm install` (via Husky):

| Hook         | Runs                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `pre-commit` | ESLint then Prettier on staged `ts`/`mjs`/`js` files, Prettier on the rest (lint-staged)               |
| `commit-msg` | commitlint with Conventional Commits                                                                   |
| `pre-push`   | `pnpm run typecheck`, `pnpm run test:changed` (only tests affected vs `origin/main`), `pnpm run build` |

Bypass hooks with `git commit --no-verify`, `git push --no-verify`, or `HUSKY=0`.

Exception: `pnpm run smoke:pack` (`scripts/smoke-pack.mjs`) intentionally keeps using `npm pack` and `npm install`, because it simulates how consumers install the published package.
