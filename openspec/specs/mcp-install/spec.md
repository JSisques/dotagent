# Delta for MCP Install

## ADDED Requirements

### Requirement: Init flow

`shitaku init` MUST build a plan (selected MCPs and skills, scope, target, per-entry action) and then apply it. `--mcps <a,b>` and `--skills <a,b>` MUST be independent and optional, but at least one kind MUST be selected: with `--yes` (or non-interactive) and neither flag, it MUST exit non-zero with a clear error and write nothing. Interactive mode MUST prompt for MCPs, for skills only when the catalog has skills, and for scope. Non-interactive mode MUST accept `--scope project|user`, apply it to both kinds, and MUST NOT prompt. The CLI program name MUST be `shitaku`.

#### Scenario: Interactive

- GIVEN a TTY, no flags, and a catalog with skills
- WHEN `init` runs
- THEN the user picks MCPs, skills, and scope, sees the plan, and confirms before any write

#### Scenario: Interactive without skills

- GIVEN a TTY and a catalog with no skills
- WHEN `init` runs
- THEN no skills prompt appears

#### Scenario: Non-interactive

- GIVEN `init --mcps github --scope project`
- WHEN run
- THEN no prompt appears and `github` is planned for `./.mcp.json`

#### Scenario: Skills only

- GIVEN `init --skills demo --scope user --yes`
- WHEN run
- THEN only `demo` is planned and no MCP file is touched

#### Scenario: Both kinds

- GIVEN `init --mcps github --skills demo --scope project --yes`
- WHEN run
- THEN both are planned under project scope and recorded in one install

#### Scenario: Neither kind

- GIVEN `init --yes` with no `--mcps` and no `--skills`
- WHEN run
- THEN it exits non-zero with an error requiring at least one, writing nothing

#### Scenario: Unknown MCP

- GIVEN `--mcps ghost`
- WHEN run
- THEN it exits non-zero naming `ghost`, writing nothing

#### Scenario: Program name

- GIVEN the CLI is invoked with `--help`
- WHEN help is printed
- THEN the program is named `shitaku`, lists `--skills`, and no `dotagent-cli` text appears

### Requirement: Scope targets

Project scope MUST write `./.mcp.json` under `mcpServers`. User scope MUST write `~/.claude.json` top-level `mcpServers`. Items whose `targets` exclude `claude-code` MUST NOT be installable.

#### Scenario: Project scope

- GIVEN no `./.mcp.json`
- WHEN `github` is installed with project scope
- THEN `./.mcp.json` is created with `mcpServers.github`

#### Scenario: User scope

- GIVEN `~/.claude.json` exists
- WHEN installed with user scope
- THEN `mcpServers.github` is added to `~/.claude.json`

### Requirement: Merge preserving unknown keys

Writes MUST be JSON merges: every key not owned by the plan, at any depth, MUST be preserved with its value.

#### Scenario: Unknown keys kept

- GIVEN `~/.claude.json` has `projects`, `theme`, and `mcpServers.other`
- WHEN `github` is installed
- THEN all existing keys and `other` are unchanged

### Requirement: Existing entries and config problems

If a server with the same name exists and differs, the system MUST NOT overwrite it without confirmation or `--force`. A missing target file MUST be created. A corrupt (unparseable) target MUST abort with a clear error and no modification.

#### Scenario: Same name, different content

- GIVEN `mcpServers.github` exists with other content
- WHEN `init` runs non-interactively without `--force`
- THEN the whole install aborts, nothing is written, and exit code is 2 (with `--force` the entry is overwritten)

#### Scenario: Identical entry

- GIVEN the identical entry exists
- WHEN `init` runs
- THEN the plan marks it unchanged and nothing is written

#### Scenario: Missing user file

- GIVEN `~/.claude.json` does not exist
- WHEN user-scope install runs
- THEN the file is created containing only `mcpServers`

#### Scenario: Corrupt user file

- GIVEN `~/.claude.json` is invalid JSON
- WHEN install runs
- THEN it aborts, the file is byte-identical, and no manifest entry is added

### Requirement: Required env variables

For each required env var, the plan MUST report whether it is set in the process environment. A missing var MUST produce a warning and MUST NOT block the install or cause a literal to be written.

#### Scenario: Missing env var

- GIVEN `GITHUB_TOKEN` is unset
- WHEN `github` is planned
- THEN the plan warns it must be set before use, and the config contains `${GITHUB_TOKEN}`
