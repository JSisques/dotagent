# Delta for Install Safety

## MODIFIED Requirements

### Requirement: Manifest

After a successful apply, the system MUST record each managed entry in `~/.claude/.shitaku/manifest.json` with kind (`mcp` or `skill`), file, key path (MCP), backup path, and a SHA-256 hash of the written content. A skill MUST be recorded per file plus a per-skill tree hash and a flag for directories shitaku created. One install record MUST cover both kinds. The manifest version MUST NOT change.
(Previously: entries were MCP-only; no kind, tree hash, or created-directory tracking)

#### Scenario: Manifest written

- GIVEN `github` and skill `demo` are installed
- WHEN apply completes
- THEN the manifest lists `github` (kind `mcp`) and `demo` (kind `skill`) with hashes in one install record

### Requirement: Undo

`undo` MUST restore managed files from backups. It MUST first compare current content hashes to the manifest, and MUST refuse for changed entries without `--force`. For skills it MUST remove only files and directories shitaku created, MUST refuse when the skill directory contains user-added files or differs from the recorded tree hash, and MUST NOT remove directories that pre-existed the install.
(Previously: undo handled MCP entries only)

#### Scenario: Clean undo

- GIVEN content matches the manifest hash
- WHEN `undo` runs
- THEN original bytes are restored and entries leave the manifest

#### Scenario: Changed since install

- GIVEN the user edited `mcpServers.github` or a skill file after install
- WHEN `undo` runs
- THEN it warns, leaves the entry, and exits non-zero unless `--force`

#### Scenario: Skill drift or extra file

- GIVEN `demo/extra.md` was added by the user
- WHEN `undo` runs without `--force`
- THEN `demo/` is untouched and exit is non-zero

#### Scenario: No manifest

- GIVEN no manifest exists
- WHEN `undo` runs
- THEN it reports nothing to undo and changes nothing

## ADDED Requirements

### Requirement: Multi-file write failure

A skill install MUST NOT leave a partially written skill directory. On any write failure the system MUST remove files and directories it created for that skill, restore any replaced directory from backup, report the error, and record no manifest entry for it. Skills MUST be written atomically per file (temp then rename), and the manifest MUST NOT list a skill until all its files are written.

#### Scenario: Failure mid-skill

- GIVEN the third of four files fails to write
- WHEN apply runs
- THEN the created files and directories are removed, the error is reported, and the manifest has no entry for the skill

#### Scenario: Failure during forced replace

- GIVEN a forced replace fails after the old directory was backed up
- WHEN apply runs
- THEN the original directory is restored byte-identical

Backups written for an install that then fails and is rolled back stay on disk under the state directory. They are referenced by no manifest entry and are not cleaned up automatically; removing them is a manual step.

#### Scenario: Missing backup at undo

- GIVEN a backup file required by `undo` was deleted
- WHEN `undo` runs
- THEN it fails before restoring or removing anything, the manifest still lists the install as not undone, and a rerun fails the same way
