# Delta for MCP Install

## MODIFIED Requirements

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
