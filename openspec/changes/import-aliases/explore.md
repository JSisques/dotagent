# Exploration: import-aliases (issue #12)

## Current State

- 103 relative imports in 28 files across `src` and `test`; 67 of them (19 files) use `../../` or deeper.
- `src` layers: `domain`, `ports`, `application`, `adapters`, plus `src/main.ts` as composition root. Tests also import `test/helpers/tmp-paths.js` relatively.
- `tsconfig.json`: NodeNext module/moduleResolution, `noEmit`, `verbatimModuleSyntax`, `strict`; includes `src`, `test`, `vitest.config.ts`; no `paths`, `outDir` or `rootDir`.
- `tsconfig.build.json`: extends base with `noEmit: false`, `rootDir: src`, `outDir: dist`, includes only `src`. Build is plain `tsc -p tsconfig.build.json` (no alias rewrite).
- TypeScript ^7.0.2, Vitest ^5.0.3, Node >=22, ESM. `bin` `dotagent-cli` -> `./dist/main.js`; `files`: `[dist, catalog, README.md]`; no `exports` or `imports` field.
- `vitest.config.ts`: `test/**/*.test.ts`, `setupFiles` `test/setup.ts`, no alias.
- `test/architecture.test.ts` scans `src` text with regexes (domain must not import fs/os/path/child_process or use `process.`; `homedir` only in `main.ts`). It does not parse relative paths, so it is unaffected by the new import form. Domain-to-adapters/application imports are not enforced today.
- Catalog path: `new URL('../catalog/', import.meta.url)` in `src/main.ts` and `join(import.meta.dirname, '..', '..', 'catalog')` in tests are unaffected by aliases and must not be rewritten by a codemod.
- Prettier: `printWidth` 120, `singleQuote`. No ESLint. Run Prettier after the codemod (shorter specifiers can reflow imports).

## Affected Areas

- `package.json` — new `imports` map.
- `tsconfig.json` — `customConditions` or `paths`.
- `tsconfig.build.json` — verify `dist` output.
- `vitest.config.ts` — `resolve.conditions` or `alias`.
- 28 files with relative imports (19 deep).
- `test/architecture.test.ts` — optional import-direction guards.

## Approaches

1. **A: Node subpath imports** (`#domain/*`, `#ports/*`, `#application/*`, `#adapters/*`). Native in `dist`.
   - A1: conditional targets with a custom condition (`{"dotagent-src": "./src/domain/*.ts", "default": "./dist/domain/*.js"}`) + `customConditions` in tsconfig + `resolve.conditions` in vitest. Single source of truth.
   - A2: issue plan — `imports` + tsconfig `paths` + vitest `resolve.alias`; map duplicated in three places.
   - A bare `"#domain/*": "./dist/domain/*"` breaks typecheck/tests on a clean checkout (no `dist`; no `outDir`/`rootDir` in base tsconfig).
   - Pros: works in published binary, no dependency, no build step. Cons: dev/prod mapping needs care; A2 duplicates the map. Effort: Medium.
2. **B: `@/` with tsc-alias**. Familiar prefix; adds dependency and post-build step; Vitest still needs its own alias; aliases leak into `dist` if the step is skipped. Effort: Medium.
3. **C: tsup bundle**. Aliases vanish at build; changes the publish model; catalog URL must be re-validated. Effort: High.
4. **D: keep relative**. No risk; issue unresolved.

## Recommendation

- Option A, preferring A1, subject to a spike on TS 7 + Vitest 5 (fall back to A2).
- Alias only the four layers; same-layer/in-layer parent imports may stay relative (acceptance: no `../` crossing top-level layers).
- `test/helpers`: add an alias or leave relative.
- Two commits: (1) config wiring + spike proof, (2) mechanical codemod + Prettier.
- Add a packed-install smoke test (`npm pack`, install in temp dir, run `--help`); Vitest cannot catch alias leakage in `dist`.
- Add an architecture guard forbidding cross-layer `../` and domain importing `#adapters`/`#application`.

## Risks

- False green: Vitest/TS resolve aliases while published `dist` fails.
- TS 7 behaviour for `imports` with `customConditions`/`paths` under NodeNext is unverified.
- Typecheck before build fails if `imports` points only at `dist`.
- Codemod over-reach on `path.join(import.meta.dirname, ...)` and `new URL('../catalog/')`.
- Prettier reflow churn must stay in the mechanical commit.
- `package.json` `imports` is published; `dist` targets must exist.

## Ready for Proposal

Yes, pending the maintainer decision on option A vs B (see state).
