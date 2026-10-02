# Skills Install Specification

## Purpose

Install, update, replace, and undo catalog skills (a directory with `SKILL.md` and resources) for Claude Code with plan, backup, manifest, and undo guarantees.

## Requirements

### Requirement: Skill scope targets

A single `--scope` MUST apply to MCPs and skills. User scope MUST target `~/.claude/skills/<name>/`; project scope MUST target `<cwd>/.claude/skills/<name>/`. Every file in the skill directory MUST be installed, including binary resources, byte-identical.

#### Scenario: User scope

- GIVEN skill `demo` with `SKILL.md` and a binary `assets/logo.png`
- WHEN installed with `--scope user`
- THEN `~/.claude/skills/demo/` holds both files byte-identical to the catalog

#### Scenario: Project scope

- GIVEN `--scope project` and cwd `/w`
- WHEN `demo` is installed
- THEN files are written under `/w/.claude/skills/demo/`

### Requirement: Per-skill classification

The plan MUST classify each skill by comparing a tree hash (relative paths plus content bytes) of the catalog skill against the target directory and the manifest:

- create: target directory absent;
- skip: target tree hash equals the catalog hash;
- update: target present, owned by the manifest, and its hash equals the recorded hash;
- conflict: target present, not owned by the manifest, and different.

#### Scenario: Create

- GIVEN no `~/.claude/skills/demo/`
- WHEN planned
- THEN `demo` is `create`

#### Scenario: Skip identical

- GIVEN the target tree is identical to the catalog skill
- WHEN planned
- THEN `demo` is `skip` and nothing is written

#### Scenario: Update owned

- GIVEN `demo` is in the manifest, the target is unmodified, and the catalog changed
- WHEN planned
- THEN `demo` is `update`

#### Scenario: Owned but modified by the user

- GIVEN `demo` is in the manifest and the target hash differs from the recorded hash
- WHEN planned
- THEN `demo` is `conflict`

#### Scenario: Conflict

- GIVEN a different `~/.claude/skills/demo/` exists and is not in the manifest
- WHEN planned
- THEN `demo` is `conflict`

### Requirement: Conflict handling

Conflicts MUST appear in the printed plan. Non-interactive runs with any conflict and no `--force` MUST write nothing and exit 2. A skill MUST NOT be overwritten silently. Interactive runs MUST warn and ask for confirmation.

#### Scenario: Non-interactive conflict

- GIVEN a conflicting `demo` and `--yes` without `--force`
- WHEN `init` runs
- THEN the plan lists the conflict, nothing is written, and exit code is 2

#### Scenario: Interactive decline

- GIVEN a conflict and the user declines
- WHEN `init` runs
- THEN nothing is written for that skill

### Requirement: Force replace

With `--force`, a conflicting skill directory MUST be fully backed up and then replaced as a whole directory (files not in the catalog skill are removed). The backup MUST be restorable by `undo`.

#### Scenario: Force replace

- GIVEN a conflicting `demo` containing an extra file `notes.txt`
- WHEN `init --force` applies
- THEN the old directory is backed up, `demo` equals the catalog skill, and `notes.txt` is gone from the target

### Requirement: Skill selection

`--skills <a,b>` MUST select catalog skills by name. An unknown name MUST exit non-zero naming it and write nothing. Skills MUST honor `--dry-run`.

#### Scenario: Unknown skill

- GIVEN `--skills ghost`
- WHEN run
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Dry run

- GIVEN `--skills demo --dry-run`
- WHEN run
- THEN the plan is printed and no file, backup, or manifest changes

### Requirement: Skill undo

`undo` MUST revert installed skills: remove files shitaku wrote, restore backed-up content for replaced directories, and remove only directories shitaku created. It MUST refuse (leave the skill untouched, exit non-zero) when the tree hash differs from the manifest, including user-added files, unless `--force`.

#### Scenario: Clean undo of created skill

- GIVEN `demo` was created by shitaku and is unchanged
- WHEN `undo` runs
- THEN `demo/` is removed and its manifest entries are cleared

#### Scenario: User-added file

- GIVEN the user added `demo/extra.md` after install
- WHEN `undo` runs without `--force`
- THEN it refuses, nothing is deleted, and exit is non-zero

#### Scenario: Pre-existing parent kept

- GIVEN `~/.claude/skills/` existed before install
- WHEN `undo` runs
- THEN `~/.claude/skills/` remains

#### Scenario: Undo of forced replace

- GIVEN `demo` replaced a non-owned directory via `--force`
- WHEN `undo` runs on unchanged content
- THEN the original directory contents are restored from backup
