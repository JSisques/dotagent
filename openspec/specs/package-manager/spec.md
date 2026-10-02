# package-manager Specification

## Purpose

pnpm is the contributor package manager for `@jsisques/shitaku`. Consumer usage (`npx @jsisques/shitaku`) is unchanged.

## Requirements

### Requirement: Pinned pnpm via packageManager

`package.json` MUST declare `packageManager` pinning pnpm 10.x (exact version with hash). `engines.pnpm` MUST NOT be added.

#### Scenario: Field present

- GIVEN the repository root
- WHEN `package.json` is read
- THEN `packageManager` starts with `pnpm@10.`

### Requirement: Single pnpm lockfile

The repository MUST commit `pnpm-lock.yaml` and MUST NOT contain `package-lock.json`. `.prettierignore` MUST list `pnpm-lock.yaml` instead of `package-lock.json`.

#### Scenario: Lockfile state

- GIVEN the committed repository
- WHEN tracked files are listed
- THEN `pnpm-lock.yaml` is present and `package-lock.json` is absent

### Requirement: Fresh-clone install

`pnpm install` on a fresh clone MUST install dependencies and Husky hooks.

#### Scenario: Install and hooks

- GIVEN a fresh clone with pnpm available
- WHEN `pnpm install` completes
- THEN dependencies are installed and `git config core.hooksPath` points to the Husky directory

### Requirement: Developer commands pass under pnpm

`pnpm test`, `pnpm run typecheck`, `pnpm run build`, `pnpm run format:check`, and `pnpm run smoke:pack` MUST pass.

#### Scenario: Quality gates green

- GIVEN a fresh pnpm install
- WHEN each listed command runs
- THEN every command exits 0

### Requirement: No developer npm commands

README, hooks, `prepublishOnly`, and `openspec/config.yaml` MUST use pnpm for developer commands. The only exception is `scripts/smoke-pack.mjs`, which MUST keep `npm pack`/`npm install` and be documented as the exception. README MUST document corepack setup (`corepack enable`).

#### Scenario: Docs and tooling

- GIVEN `README.md`, `.husky/*`, `package.json` scripts, and `openspec/config.yaml`
- WHEN searched for developer npm commands (`npm run`, `npx --no`, and `npm install` other than the documented "not supported" note and the smoke-pack exception)
- THEN no match is found, and README documents corepack and the smoke-pack exception

#### Scenario: Consumer usage unchanged

- GIVEN a consumer
- WHEN running `npx @jsisques/shitaku`
- THEN behavior is identical to before the change
