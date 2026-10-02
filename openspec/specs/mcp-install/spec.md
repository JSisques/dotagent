# Delta for MCP Install

## ADDED Requirements

### Requirement: Init flow

`shitaku init` MUST build a plan (selected MCPs, scope, target file, per-entry action) and then apply it. Interactive mode MUST prompt for MCPs and scope. Non-interactive mode MUST accept `--mcps <a,b>` and `--scope project|user` and MUST NOT prompt. The CLI program name MUST be `shitaku`.
(Previously: the command was `dotagent-cli init`)

#### Scenario: Interactive

- GIVEN a TTY and no flags
- WHEN `init` runs
- THEN the user picks MCPs and scope, sees the plan, and confirms before any write

#### Scenario: Non-interactive

- GIVEN `init --mcps github --scope project`
- WHEN run
- THEN no prompt appears and `github` is planned for `./.mcp.json`

#### Scenario: Unknown MCP

- GIVEN `--mcps ghost`
- WHEN run
- THEN it exits non-zero naming `ghost`, writing nothing

#### Scenario: Program name

- GIVEN the CLI is invoked with `--help`
- WHEN help is printed
- THEN the program is named `shitaku` and no `dotagent-cli` text appears

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
