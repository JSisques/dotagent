# Delta for Module Resolution

## ADDED Requirements

### Requirement: Package Identity

`package.json` MUST declare `name` as `@jsisques/shitaku`, a `bin` entry named `shitaku` (and no `dotagent-cli` entry), and `repository` pointing to `https://github.com/JSisques/shitaku`. `package-lock.json` MUST be consistent with these values.

#### Scenario: Metadata renamed

- GIVEN the repository root
- WHEN `package.json` and `package-lock.json` are read
- THEN the name is `@jsisques/shitaku`, `bin` exposes only `shitaku`, and `repository` is the shitaku URL

#### Scenario: No legacy name in live files

- GIVEN all tracked files outside `openspec/changes/archive`
- WHEN searched case-insensitively for `dotagent`
- THEN no match is found

## MODIFIED Requirements

### Requirement: Packed-Install Smoke Test

A smoke script MUST run `npm pack`, install the resulting tarball in a temporary directory, and run `shitaku --help` and `node dist/main.js --help`, both of which MUST exit with code 0. The smoke script MUST be part of `prepublishOnly`.
(Previously: the bin was invoked as `dotagent-cli --help`)

#### Scenario: Packed package runs

- GIVEN a successful build
- WHEN the smoke script packs and installs the tarball in a temp directory
- THEN `shitaku --help` prints help and exits 0

#### Scenario: Broken resolution blocks publish

- GIVEN a build whose packed output fails to resolve a module at runtime
- WHEN `prepublishOnly` runs
- THEN the smoke script exits non-zero and publishing is aborted
