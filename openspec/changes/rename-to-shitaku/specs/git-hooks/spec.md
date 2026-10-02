# Delta for Git Hooks

## MODIFIED Requirements

### Requirement: Consumer safety

Hook tooling and configuration (`.husky`, `commitlint.config.js`, `.nvmrc`) MUST NOT appear in the published package, and consumer installs MUST NOT run `prepare`.
(Previously: the unchanged-behavior check referenced `npx @jsisques/dotagent`)

#### Scenario: Package contents

- GIVEN the repository with hooks added
- WHEN `npm pack --dry-run` is run
- THEN no `.husky`, commitlint, or `.nvmrc` file is listed
- AND `npx @jsisques/shitaku` behavior is unchanged
