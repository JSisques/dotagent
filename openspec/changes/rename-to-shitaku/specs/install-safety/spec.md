# Delta for Install Safety

## ADDED Requirements

### Requirement: No legacy state migration

The system MUST NOT read, migrate, or fall back to `~/.claude/.dotagent/`. State lives only under `~/.claude/.shitaku/`.

#### Scenario: Legacy directory ignored

- GIVEN `~/.claude/.dotagent/manifest.json` exists and `~/.claude/.shitaku/` does not
- WHEN `undo` runs
- THEN it reports nothing to undo and leaves the legacy directory untouched

## MODIFIED Requirements

### Requirement: Backup and atomic write

Before modifying an existing file, the system MUST back it up to `~/.claude/.shitaku/backups/`. Writes MUST be atomic (temp file then rename). The target MUST be re-read immediately before writing, and changes made since planning MUST be merged, not lost.
(Previously: backups went to `~/.claude/.dotagent/backups/`)

#### Scenario: Backup taken

- GIVEN `~/.claude.json` exists
- WHEN user-scope install applies
- THEN a byte-identical backup exists under `~/.claude/.shitaku/backups/` before the file changes

#### Scenario: Claude wrote meanwhile

- GIVEN `~/.claude.json` gains a key after planning
- WHEN apply runs
- THEN the re-read picks up the key and it survives in the result

#### Scenario: Write failure

- GIVEN the rename fails
- WHEN apply runs
- THEN the original file is intact and the error is reported

### Requirement: Manifest

After a successful apply, the system MUST record each managed entry in `~/.claude/.shitaku/manifest.json` with file, key path, backup path, and a SHA-256 hash of the written content.
(Previously: the manifest was `~/.claude/.dotagent/manifest.json`)

#### Scenario: Manifest written

- GIVEN `github` is installed
- WHEN apply completes
- THEN `~/.claude/.shitaku/manifest.json` lists `github` with its hash
