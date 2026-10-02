# shitaku

> Install a curated AI agent setup (MCP servers and skills) for Claude Code with one command.

<!--
  Badges that are intentionally NOT here yet (add them when their dependency lands):
  TODO(npm publish): npm version and npm downloads badges (shields.io/npm/v and /npm/dm for @jsisques/shitaku).
  TODO(website): website badge/link once the docs site exists.
-->

[![CI](https://github.com/JSisques/shitaku/actions/workflows/ci.yml/badge.svg)](https://github.com/JSisques/shitaku/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=node.js&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<!--
  TODO(demo): add a GIF or screenshot of `shitaku init` running here, e.g.
  ![shitaku init demo](docs/assets/demo.gif)
  Not recorded yet; do not embed a path that does not exist.
-->

## Quickstart

```sh
# 1. Pick MCPs and skills interactively and review the plan
npx @jsisques/shitaku init

# 2. Or install without prompts
npx @jsisques/shitaku init --mcps github,context7 --scope project --yes

# 3. Changed your mind? Restore the files changed by the last install
npx @jsisques/shitaku undo
```

Requires Node `>=22.13`. After a global install the command is just `shitaku`.

## Table of contents

- [Quickstart](#quickstart)
- [Why shitaku](#why-shitaku)
- [Catalog](#catalog)
- [Usage](#usage)
- [Custom catalogs and trust](#custom-catalogs-and-trust)
- [Known limitation](#known-limitation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Development](#development)

## Why shitaku

Setting up an AI coding agent means hand-editing config files (`.mcp.json`, `~/.claude.json`, `~/.claude/skills/`) and repeating that on every machine and project. shitaku makes that setup portable and repeatable:

- **One command** installs MCP servers and skills from a curated catalog, at project or user scope.
- **Safe by default**: `--dry-run` previews the plan, conflicting entries are never overwritten silently, and secrets are written only as `${VAR}` placeholders, never as values.
- **Reversible**: every change is backed up and recorded, so `shitaku undo` restores the previous state.
- **Extensible**: point `--source` at your own catalog folder.

## Catalog

The bundled catalog lives in [`catalog/`](catalog/).

### MCP servers

| Name       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `context7` | Up-to-date library documentation for coding agents             |
| `github`   | GitHub remote MCP server (repositories, issues, pull requests) |

### Skills

| Name            | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `example-skill` | Minimal example skill that shows the catalog skill layout. |

## Usage

```sh
# Interactive: pick MCPs, skills and scope, review the plan, confirm
npx @jsisques/shitaku init

# Non-interactive: no prompts
shitaku init --mcps github,context7 --scope project

# Skills only, or both kinds in one install (one --scope applies to both)
shitaku init --skills example-skill --scope project
shitaku init --mcps github --skills example-skill --scope project

# Preview only: prints the plan, writes nothing (no backups, no manifest)
shitaku init --mcps github --scope user --dry-run

# Restore the files changed by the last install
shitaku undo [--id <id>] [--force] [--dry-run]
```

Scopes: `project` writes MCPs to `./.mcp.json` and skills to `./.claude/skills/`; `user` writes MCPs to `~/.claude.json` and skills to `~/.claude/skills/` (close Claude Code first when writing `~/.claude.json`).

Flags for `init`: `--mcps <a,b>`, `--skills <a,b>`, `--scope project|user`, `--source <folder>`, `--dry-run`, `--yes` (skip confirmation, needs `--scope` and at least one of `--mcps`/`--skills`), `--force` (overwrite entries and skill directories that differ). `--mcps` and `--skills` are independent and optional, but at least one kind must be selected. Interactively, the skills prompt appears only when the catalog has skills.

Exit codes: `0` ok, `1` error, `2` unresolved conflicts (an existing entry with the same name differs; re-run with `--force`), `3` undo refused because a file changed since the install (use `--force`).

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Before changing a file, shitaku backs it up under `~/.claude/.shitaku/backups/` and records the install in `~/.claude/.shitaku/manifest.json`.

### Skills

A skill is a directory `catalog/skills/<name>/` that holds a `SKILL.md` and any supporting files (scripts, templates, binary assets). `SKILL.md` starts with frontmatter that has a single-line `name` (it must equal the directory name and match `^[a-z0-9][a-z0-9-]*$`) and a non-empty single-line `description`. List the skill under `items.skills` in `catalog/catalog.json`. A skill directory that is not listed, or a listed one that is missing or invalid, is skipped with a warning (an invalid name that could escape the directory, such as `../evil`, fails the whole catalog). The bundled `example-skill` shows the layout.

Install behavior: each skill is copied to `<scope skills dir>/<name>/`, with `SKILL.md` written last so a half-written skill never loads. The install is one entry in the manifest, together with any MCPs in the same run, and `shitaku undo` reverts both.

Safety:

- An existing directory with the same name is never overwritten silently. If it differs from the catalog version and shitaku did not install it (or it was modified since), it is reported as a conflict in the plan and `init` exits `2` without writing anything. Interactively you are asked per skill.
- `--force` replaces the whole directory (files that are not in the catalog version are deleted) after backing every replaced file up under `~/.claude/.shitaku/backups/`. `undo` restores them byte for byte.
- If a write fails, everything written so far is rolled back and the directories the install created are removed. Backups stay on disk.
- `undo` refuses (exit `3`) when a recorded file changed, or when you added a file under a skill directory, since the install. `--force` restores the recorded files and leaves unknown files alone. Directories that the install created are removed only when empty.
- Skill symlinks (the directory, a file inside it, or a catalog file) are rejected, and the catalog and target trees are walked with limits on file count, depth, per-file size and total size.

Before downgrading shitaku to a version without skills support, run `shitaku undo` for any install that included skills: older versions do not understand skill entries in the manifest.

Limits: skills are copied as plain files, so shitaku does not run, lint or sandbox them. There is no `list` command or profile selection on the CLI yet.

### Custom catalogs and trust

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries in a catalog are written to your config and Claude Code executes their `command` later. Skills from a `--source` folder are copied into your skills directory, and Claude Code may follow their instructions or run their scripts. Only use folders you trust.

### Known limitation

Whether `${VAR}` placeholders are expanded in user-scope `~/.claude.json` entries is unverified. For entries with env placeholders (for example `github`), prefer project scope (`.mcp.json`).

## Roadmap

Planned work and open ideas are tracked as [GitHub issues](https://github.com/JSisques/shitaku/issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide (setup, adding catalog items, commits, PRs).

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

### Releasing

Releases are manual: a maintainer dispatches the `CD` workflow on `main`. See [docs/releasing.md](docs/releasing.md) for the bootstrap, dry runs and failure recovery.
