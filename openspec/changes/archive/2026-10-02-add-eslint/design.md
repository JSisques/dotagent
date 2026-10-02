# Design: Add ESLint with typescript-eslint (issue #29)

## Technical Approach

Dual compiler, resolved by package identity rather than by the `tsc` bin. `typescript` is pinned to `~6.0` so typescript-eslint's `require('typescript')` gets TS 6. Stable TS 7 is installed under a pnpm alias `typescript-native` and invoked by explicit path. ESLint 10 flat config with `recommendedTypeChecked` on `*.ts`. A vitest tooling test guards the compiler split and the lint gate. No `src/` layer is touched; this is tooling only, so the domain stays free of infrastructure imports.

## Architecture Decisions

| Question                     | Options                                                                                      | Tradeoff                                                                                                                                                                  | Decision                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Native compiler package      | `@typescript/native-preview` (bin `tsgo`) / alias `typescript-native: npm:typescript@^7.0.2` | Preview publishes nightly `-dev` builds, so the compiler would change on every lockfile refresh. The alias keeps the stable 7.0.2 currently in use, but its bin is `tsc`  | **Alias of stable TS 7**                                                                                         |
| `tsc` bin clash              | rely on `.bin/tsc` / explicit path                                                           | Both packages declare bin `tsc`, so the winner in `.bin` depends on pnpm conflict rules                                                                                   | **Scripts never call bare `tsc`.** Use `node node_modules/typescript-native/bin/tsc`                             |
| tsc-alias runtime dependency | —                                                                                            | Verified locally: tsc-alias 1.9.7 declares `typescript` only in devDependencies. Its `dist/` has zero `typescript` references, and it reads config through `get-tsconfig` | **No impact.** Keep it, with `check-dist-aliases.mjs` as the safety net                                          |
| Silent fallback to TS 6      | runtime version echo / unit test guard                                                       | A unit test fails fast in `pnpm test` and pre-push, and can be written first (strict TDD)                                                                                 | **`test/tooling.test.ts` guard** (see Interfaces)                                                                |
| ESLint major                 | 9 / 10                                                                                       | typescript-eslint 8.71.0 peers `eslint ^8.57 \|\| ^9 \|\| ^10` (exploration, `npm view`). ESLint 10 is flat-only and needs Node 22.13 or later on the 22 line             | **`eslint@^10` + `@eslint/js@^10`**. Confirm with `pnpm view` at apply, and fall back to `^9` if peers reject 10 |
| tsconfig for linted files    | add includes / `tsconfig.eslint.json` / none                                                 | `.ts` files are already in `include`. `.js`/`.mjs` use `disableTypeChecked` (`projectService: false`), so they need no tsconfig                                           | **No tsconfig change**                                                                                           |
| Config helper                | `tseslint.config()` / `defineConfig` from `eslint/config`                                    | `tseslint.config` is deprecated in favor of ESLint's `defineConfig`                                                                                                       | **`defineConfig`**                                                                                               |
| lint-staged overlap          | keep `"*"` / negated glob                                                                    | `"*"` and `"*.{ts,mjs,js}"` would run Prettier concurrently on the same file (a race)                                                                                     | **Catch-all becomes `"!(*.{ts,mjs,js})"`**                                                                       |
| Disable justification        | eslint-comments plugin / test scan                                                           | The plugin adds a dependency. A scan test is enough                                                                                                                       | **Scan in `test/tooling.test.ts`**                                                                               |

## Data Flow

    pnpm lint ──> eslint . ──> typescript-eslint ──> require('typescript') = 6.0.x
    pnpm typecheck/build ──> node node_modules/typescript-native/bin/tsc
        ──> getExePath() ──> @typescript/typescript-<os>-<arch> (7.0.2 native)
    build ──> tsc(7) emit ──> tsc-alias (get-tsconfig, no TS) ──> check-dist-aliases.mjs
    commit ──> husky pre-commit ──> lint-staged ──> eslint --fix ──> prettier --write

The alias works because `bin/tsc` resolves its platform binary relative to the real `.pnpm` store path and reads its own `package.json` (name `typescript`, bin `tsc`).

## File Changes

| File                                     | Action     | Description                                                                                                                                                                                           |
| ---------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                           | Modify     | devDeps: `typescript: ~6.0.x`, `typescript-native: npm:typescript@^7.0.2`, `eslint`, `@eslint/js`, `typescript-eslint@^8.71.0`, `eslint-config-prettier`, `globals`. Scripts and lint-staged as below |
| `eslint.config.js`                       | Create     | Flat config (structure below)                                                                                                                                                                         |
| `test/tooling.test.ts`                   | Create     | Compiler-split guard, lint-gate behavior, and disable-reason scan                                                                                                                                     |
| `test/fixtures/lint/floating-promise.ts` | Create     | Deliberate violation. Globally ignored, and linted only by the test with `ignore: false`                                                                                                              |
| `src/**`, `test/**`, `scripts/*.mjs`     | Modify     | Fix violations, or disable with `-- reason`                                                                                                                                                           |
| `pnpm-lock.yaml`                         | Regenerate | —                                                                                                                                                                                                     |

Scripts:

```json
"typecheck": "node node_modules/typescript-native/bin/tsc --noEmit",
"build": "node node_modules/typescript-native/bin/tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json && node scripts/check-dist-aliases.mjs",
"lint": "eslint .",
"lint:fix": "eslint . --fix"
```

lint-staged:

```json
{ "*.{ts,mjs,js}": ["eslint --fix", "prettier --write"], "!(*.{ts,mjs,js})": "prettier --write --ignore-unknown" }
```

The husky hooks stay unchanged.

## Interfaces / Contracts

`eslint.config.js` order:

1. `globalIgnores(['dist', 'coverage', 'node_modules', 'openspec', 'test/fixtures/lint'])`
2. `js.configs.recommended`
3. `{ files: ['**/*.ts'], extends: [tseslint.configs.recommendedTypeChecked], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } }`
4. `{ files: ['test/**/*.ts'], rules: { /* only justified relaxations */ } }`
5. `{ files: ['**/*.{js,mjs}'], extends: [tseslint.configs.disableTypeChecked], languageOptions: { globals: globals.node } }`
6. `eslintConfigPrettier` (last)

`test/tooling.test.ts` asserts the following:

- Installed `typescript/package.json` major is 6, and `typescript-native/package.json` major is 7.
- The `typecheck` and `build` scripts invoke `node_modules/typescript-native/bin/tsc` and contain no bare `tsc ` token.
- `new ESLint({ cwd: ROOT, ignore: false }).lintFiles([fixture])` reports `@typescript-eslint/no-floating-promises`.
- Every `eslint-disable` in `src`, `test` and `scripts` contains `--`.

## Testing Strategy

| Layer          | What                                 | Approach                                                                            |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Unit           | Compiler split, disable reasons      | Read `package.json` and installed manifests. RED before deps change                 |
| Unit (tooling) | Rule fires on a type-aware violation | ESLint Node API against the fixture                                                 |
| Gate           | Repo clean                           | `pnpm lint`, typecheck, test, build, format:check (RED = violations, GREEN = fixed) |

## Threat Matrix

N/A. This change adds no routing, subprocess, VCS/PR automation, or executable-file classification. npm scripts change their compiler invocation only. The command shape is the same and takes no user input.

## Migration / Rollout

No migration required. Revert the PR and regenerate the lockfile.

## Open Questions

- [ ] The spec's "Explicit compiler split" requirement says `tsgo`. The design uses stable TS 7 through the `typescript-native` alias (bin `tsc`, explicit path). The spec wording should become "native TS 7 compiler via explicit `typescript-native` path".
- [ ] Spec "Pre-commit integration" keeps "the existing catch-all". The design narrows it to a negated glob to avoid the Prettier race; confirm this is acceptable.
- [ ] Should `pnpm run lint` be added to pre-push and `prepublishOnly`? It is not in scope per the proposal.
