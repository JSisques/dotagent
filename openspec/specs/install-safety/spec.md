# Delta for Install Safety

## ADDED Requirements

### Requirement: Dry run
With `--dry-run`, the system MUST print the plan and MUST NOT create, modify, or delete any file, including backups and manifest.

#### Scenario: Dry run
- GIVEN `init --mcps github --scope user --dry-run`
- WHEN run
- THEN the plan is printed and the filesystem is unchanged

### Requirement: Backup and atomic write
Before modifying an existing file, the system MUST back it up to `~/.claude/.dotagent/backups/`. Writes MUST be atomic (temp file then rename). The target MUST be re-read immediately before writing, and changes made since planning MUST be merged, not lost.

#### Scenario: Backup taken
- GIVEN `~/.claude.json` exists
- WHEN user-scope install applies
- THEN a byte-identical backup exists before the file changes

#### Scenario: Claude wrote meanwhile
- GIVEN `~/.claude.json` gains a key after planning
- WHEN apply runs
- THEN the re-read picks up the key and it survives in the result

#### Scenario: Write failure
- GIVEN the rename fails
- WHEN apply runs
- THEN the original file is intact and the error is reported

### Requirement: Manifest
After a successful apply, the system MUST record each managed entry in `~/.claude/.dotagent/manifest.json` with file, key path, backup path, and a SHA-256 hash of the written content.

#### Scenario: Manifest written
- GIVEN `github` is installed
- WHEN apply completes
- THEN the manifest lists `github` with its hash

### Requirement: Undo
`undo` MUST restore managed files from backups. It MUST first compare current content hashes to the manifest, and MUST refuse for changed entries without `--force`.

#### Scenario: Clean undo
- GIVEN content matches the manifest hash
- WHEN `undo` runs
- THEN original bytes are restored and entries leave the manifest

#### Scenario: Changed since install
- GIVEN the user edited `mcpServers.github` after install
- WHEN `undo` runs
- THEN it warns, leaves the entry, and exits non-zero unless `--force`

#### Scenario: No manifest
- GIVEN no manifest exists
- WHEN `undo` runs
- THEN it reports nothing to undo and changes nothing

### Requirement: Unmanaged protection
The system MUST NOT overwrite or remove entries absent from the manifest without a warning plus confirmation or `--force`.

#### Scenario: Unmanaged same name
- GIVEN `github` exists but is not in the manifest
- WHEN install runs interactively
- THEN the user is warned and asked to confirm before replacement

### Requirement: Secret placeholders
Only `${VAR}` placeholders MUST be written. Resolved env values MUST NOT appear in any written file, manifest, or output.

#### Scenario: Placeholder only
- GIVEN `GITHUB_TOKEN=abc123` is set
- WHEN install applies
- THEN no written file contains `abc123`

### Requirement: Test isolation
All filesystem paths MUST come from injected `homeDir` and `cwd`. Tests MUST NOT touch the real home directory.

#### Scenario: Injected paths
- GIVEN a temp `homeDir` and `cwd`
- WHEN the suite runs
- THEN all reads and writes stay inside them
