# Delta for MCP Install

## MODIFIED Requirements

### Requirement: Init flow

`shitaku init` MUST build a plan (selected MCPs and skills, scope, target, per-entry action) and then apply it. `--mcps <a,b>` and `--skills <a,b>` MUST be independent and optional, but at least one kind MUST be selected: with `--yes` (or non-interactive) and neither flag, it MUST exit non-zero with a clear error and write nothing. Interactive mode MUST prompt for MCPs, for skills only when the catalog has skills, and for scope. Non-interactive mode MUST accept `--scope project|user`, apply it to both kinds, and MUST NOT prompt. The CLI program name MUST be `shitaku`.
(Previously: only `--mcps` existed and MCPs were the only selectable kind)

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
