# Delta for Catalog

## ADDED Requirements

### Requirement: Catalog layout and schema
The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "profiles": [...] } }`, listing item names), `mcps/<name>.json`, and `profiles/<name>.json`. Each MCP item MUST have `name`, `description`, `server`, and optional `env` and `targets`. Env entries MUST carry `name` and `required`. `skills/`, `instructions/`, `hooks/` are reserved and MUST be ignored.

#### Scenario: Valid MCP item
- GIVEN `mcps/github.json` matches the schema
- WHEN the catalog is loaded
- THEN the item is available by name `github`

#### Scenario: Reserved folders
- GIVEN the catalog contains `skills/`
- WHEN loaded
- THEN no error occurs and no skill items are exposed

### Requirement: Catalog sources
The system MUST load the bundled catalog by default and MUST load a local folder when `--source <folder>` is given. Remote sources MUST NOT be supported.

#### Scenario: Custom folder
- GIVEN `--source ./my-catalog`
- WHEN `init` runs
- THEN only items from `./my-catalog` are offered

#### Scenario: Missing source
- GIVEN `--source ./nope` does not exist
- WHEN `init` runs
- THEN it exits non-zero with a clear error and writes nothing

### Requirement: Item validation
The loader MUST validate every item with the schema. An invalid item MUST be reported with file path and reason, and MUST NOT be installable. Valid items SHOULD remain usable.

#### Scenario: Invalid item
- GIVEN `mcps/bad.json` lacks `server`
- WHEN loaded
- THEN an error names `mcps/bad.json` and `server`, and `bad` is not selectable

#### Scenario: Literal secret in item
- GIVEN an item header holds a literal token instead of `${VAR}`
- WHEN validated
- THEN the item is rejected as containing a secret literal

### Requirement: Profile extends
Profiles MAY `extends` other profiles. Resolution MUST merge parents first, de-duplicate MCP names, and fail on cycles or unknown references. Applying profiles in `init` is out of scope; resolution only.

#### Scenario: Extends resolved
- GIVEN `web` extends `base`, and `base` lists `context7`
- WHEN `web` is resolved
- THEN its MCPs include `context7` and `github` once each

#### Scenario: Cycle
- GIVEN `a` extends `b` and `b` extends `a`
- WHEN resolved
- THEN resolution fails naming the cycle `a -> b -> a`

#### Scenario: Unknown reference
- GIVEN a profile lists MCP `ghost` that does not exist
- WHEN resolved
- THEN it fails naming `ghost`
