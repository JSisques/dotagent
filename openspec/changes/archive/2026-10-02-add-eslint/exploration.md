# Exploration: add ESLint with typescript-eslint (issue #29)

## Current State

- Tooling today is Prettier (`format`, `format:check`), `tsc --noEmit` (`typecheck`) and vitest. There is no linter and no `.github/` directory, so no CI workflows yet (issue #26 will add them).
- `typescript` is `^7.0.2` (the native Go compiler). typescript-eslint 8.71.0 declares peer `typescript >=4.8.4 <6.1.0` (verified via `npm view`).
  - TS 7.0 has no stable programmatic API; it is expected in 7.1 (`next` dist-tag is `7.1.0-dev`).
  - Forcing the install reportedly crashes in typescript-estree's program creation (`Cannot read properties of undefined (reading 'Cjs')`); typescript-eslint issue #12518 was closed as "not planned". Not reproduced locally.
- `tsconfig.json`: strict, noUncheckedIndexedAccess, verbatimModuleSyntax, NodeNext, `paths` for `@/*` and `@test/*`. `include`: `src`, `test`, `vitest.config.ts`. `tsconfig.build.json` extends it with `include: ["src"]`.
- Files: 19 `.ts` in `src`, 18 in `test` (including `test/setup.ts` and `test/helpers`), `vitest.config.ts`, and 2 plain-JS scripts in `scripts/*.mjs` that use Node globals and `import.meta.dirname`.
- Hooks:
  - pre-commit runs `pnpm exec lint-staged` (`"*": "prettier --write --ignore-unknown"`).
  - pre-push runs typecheck, test:changed and build.
  - `prepublishOnly` runs typecheck, test, build and smoke:pack.
  - `.prettierignore` lists dist, node_modules, pnpm-lock.yaml, coverage, .atl/ and openspec/changes/archive/.
- Existing violations (estimate only, nothing installed):
  - 0 `any`, `@ts-*` or `eslint-disable` in `src`; about 5 `any`/non-null hits in `test/application/undo-install.test.ts` and `test/application/init-mcps.test.ts`.
  - Async-heavy code, so likely hits are `no-floating-promises`, `no-misused-promises`, `require-await`, mostly in tests (`program.test.ts`, `init-mcps.test.ts`, `undo-install.test.ts`).
  - Estimate: tens of violations at most.

## Affected Areas

- `package.json`: devDeps (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, optionally `globals`), `lint` script (maybe `lint:fix`), lint-staged entry, possibly lint in `prepublishOnly`.
- `eslint.config.js` (new): flat config.
- `.husky/pre-commit` and lint-staged config: add `eslint --fix` for `*.{ts,mjs,js}`. Optionally `pnpm run lint` in pre-push.
- `tsconfig.json`: may need `scripts` and `eslint.config.js` in `include`, or a separate `tsconfig.eslint.json`.
- `src/**`, `test/**`, `scripts/*.mjs`: fix or justify violations.
- Issue #26 (PR workflow) depends on `pnpm lint` existing.

## Approaches (TypeScript strategy)

1. Keep TS 7 and force typescript-eslint onto it: unsupported, fails type-aware criterion. Not viable.
2. **Dual compiler (DECIDED by the user):** TS 6.x for linting (typescript-eslint, possibly tsc-alias), native compiler (`@typescript/native-preview` / tsgo) for `typecheck` and `build`.
   - Pros: type-aware lint works, fast compiler kept, community-recommended workaround.
   - Cons: two compilers, `tsc` bin ambiguity, scripts must call the right binary, tsc-alias may depend on the `typescript` package, revisit at TS 7.1.
3. Downgrade fully to TS 6.x: simplest, but reverses the TS 7 upgrade.
4. Non-type-aware presets only: misses the acceptance criterion.

Independent sub-decisions:

- Type info: `parserOptions.projectService: true` with `tsconfigRootDir: import.meta.dirname`; `tseslint.configs.disableTypeChecked` for `scripts/*.mjs` and `eslint.config.js`.
- Preset: start with `recommendedTypeChecked`; `strictTypeChecked` later or per folder.
- Prettier: `eslint-config-prettier` last in the array; no `eslint-plugin-prettier`.
- Overrides: relaxed rules in `test/**` only where needed; `scripts/**/*.mjs` and `eslint.config.js` get `js.configs.recommended` plus `globals.node`. Ignore `dist`, `coverage`, `node_modules`, `openspec`.
- lint-staged: `"*.{ts,mjs,js}": ["eslint --fix", "prettier --write"]` plus the existing `"*"` entry. `pnpm lint` is the full gate for #26.
- Verify the typescript-eslint peer range against the latest ESLint major at apply time (peer shows `eslint ^8.57 || ^9 || ^10`).

## Risks

- Dual-compiler setup can confuse `tsc` bin resolution and the tsc-alias build step.
- Violation counts are an estimate only.
- Type-aware lint in lint-staged slows commits; `projectService` mitigates this.
- Issue #29 says npm, but the repo is on pnpm: use `pnpm lint` and `pnpm exec`.
- TDD: the lint config has no natural unit test; practical RED/GREEN is `pnpm lint` failing then passing, plus an optional deliberately-bad fixture proving rules fire.

## Ready for Proposal

Yes. TS strategy decided: dual compiler.

Sources:

- https://github.com/typescript-eslint/typescript-eslint/issues/12518
- https://dev.to/dev_encyclopedia/why-your-typescript-7-upgrade-broke-eslint-ts-jest-and-ts-morph-385k
