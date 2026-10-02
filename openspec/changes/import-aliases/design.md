# Design: `@/` and `@test/` import aliases (issue #12)

## Technical Approach

Approach B as confirmed: `@/*` -> `src/*`, `@test/*` -> `test/*`, `.js` suffix kept. TypeScript resolves through `paths`, the build rewrites `dist` with `tsc-alias`, and Vitest resolves through `resolve.alias`. Two safety nets catch false greens: a dist-leak scan and a packed-install smoke test. The first implementation task is a **spike** that proves all three resolvers before any mass rewrite.

## Architecture Decisions

| Decision              | Choice                                                                | Rejected                                                       | Rationale                                                                                               |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Alias source of truth | `paths` in `tsconfig.json` only; `tsconfig.build.json` inherits it    | Duplicating `paths` in the build config                        | One map for typecheck and build.                                                                        |
| `baseUrl`             | Not set by default                                                    | Always add `baseUrl`                                           | TS 6 deprecated `baseUrl`, and TS 7 may reject it. Add it only through the fallback ladder below.       |
| Vitest mapping        | Regex `resolve.alias` entries pointing at absolute `src/` and `test/` | `vite-tsconfig-paths` plugin                                   | Avoids a new dependency. The plugin is a last-resort fallback.                                          |
| Rewrite rule          | Rewrite only import/export specifiers that start with `../`           | Also rewrite `./` and descendant (`./adapters/...`) specifiers | Matches the proposal. `src/main.ts` uses `./adapters/...` and stays unchanged.                          |
| No-`../` guard timing | Lands in commit 2 with the codemod                                    | Commit 1                                                       | Every commit must stay green, because pre-push runs the tests. Direction guards still land in commit 1. |
| Script language       | `scripts/*.mjs`, plain Node ESM                                       | TS scripts                                                     | No TS loader is needed; they run before and after the build.                                            |

### Spike (first task) and fallback ladders

Canary: in commit 1, convert one cross-layer `src` import and one `test` import that uses `@/` and `@test/helpers`. Then run `typecheck`, `test`, `build`, the dist guard and the smoke test.

**tsc-alias + TS 7**

1. `tsc-alias -p tsconfig.build.json` rewrites `dist` correctly: done.
2. It needs `baseUrl`, and TS 7 accepts `baseUrl: "."` without errors: add `baseUrl` to `tsconfig.json`.
3. TS 7 rejects `baseUrl`: create `tsconfig.alias.json` (extends the build config and adds `baseUrl: "."`). Only `tsc-alias -p tsconfig.alias.json` reads it; `tsc` never does.
4. `tsc-alias` cannot run under TS 7 at all: **BLOCK** and escalate to the maintainer. Do not swap tools on our own.

**Vitest 5 `.js` -> `.ts` through the alias**

1. Regex alias resolves `@/x.js` to `src/x.ts`: done.
2. If not: use Vite's native `resolve.tsconfigPaths: true`, if the installed Vite supports it, and drop the manual aliases.
3. If not: add an inline `resolveId` plugin in `vitest.config.ts` that maps the prefix and swaps `.js` for `.ts`.

## Data Flow

    src/**/*.ts --tsc--> dist/**/*.js (@/ specifiers) --tsc-alias--> dist (relative)
                                                          |
                         check-dist-aliases.mjs (fails on @/ or @test/)
                                                          |
                         smoke-pack.mjs: npm pack -> temp install -> --help

## File Changes

| File                             | Action            | Description                                                                                                                                                                                                                         |
| -------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`                  | Modify            | `"paths": {"@/*": ["./src/*"], "@test/*": ["./test/*"]}`                                                                                                                                                                            |
| `tsconfig.build.json`            | None              | Inherits `paths`. If `src` imports `@test/`, `rootDir` fails the build.                                                                                                                                                             |
| `vitest.config.ts`               | Modify            | `resolve.alias`: `{find: /^@\/(.*)$/, replacement: <abs src>/$1}` and the same shape for `@test/`, built with `fileURLToPath(new URL(...))`                                                                                         |
| `package.json`                   | Modify            | devDep `tsc-alias`; `build`: `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json && node scripts/check-dist-aliases.mjs`; `smoke:pack`: `node scripts/smoke-pack.mjs`; `prepublishOnly`: append `&& npm run smoke:pack` |
| `scripts/check-dist-aliases.mjs` | Create            | Dist-leak guard                                                                                                                                                                                                                     |
| `scripts/smoke-pack.mjs`         | Create            | Packed-install smoke test                                                                                                                                                                                                           |
| `test/architecture.test.ts`      | Modify            | Scan `test/` as well as `src/`; new guards                                                                                                                                                                                          |
| `src/**`, `test/**` (28 files)   | Modify (commit 2) | Specifiers only                                                                                                                                                                                                                     |

## Interfaces / Contracts

**Dist guard.** It walks `dist/**/*.js` and matches `/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]@(?:test)?\//`. It prints `file:line` for each offender and exits 1. It also exits 1 if `dist` is missing or empty.

**Smoke test.** It fails if `dist/main.js` is missing; it does not build. Steps:

1. Create a temp dir with `mkdtempSync(os.tmpdir())`.
2. Run `npm pack --pack-destination <tmp> --json` to get the tarball.
3. Write a minimal `package.json` in the temp dir.
4. Run `npm install --no-audit --no-fund --ignore-scripts <tarball>`.
5. Run `<tmp>/node_modules/.bin/dotagent-cli --help`. This proves the shebang and the exec bit.
6. Run `node <tmp>/node_modules/@jsisques/dotagent/dist/main.js --help`.
7. Assert exit 0 and that stdout matches `/Usage/`.

Child processes run with `execFileSync`, with no shell, `HOME` pointing at the temp dir, and `npm.cmd` on win32. The temp dir is removed in `finally`. The script stays out of pre-push because it is slow and needs the network.

**Architecture guards.** The specifier regex anchors on `from`, `import(` and `import '`, so `join(import.meta.dirname, '..')` and `new URL('../catalog/', ...)` never match.

- Commit 1: `src` never imports `@test/`; `src/domain` never imports `@/adapters` or `@/application`.
- Commit 2: no `../` specifier anywhere in `src` or `test`.

## Codemod (commit 2)

A one-off Node script, not committed; its command goes in the commit body. For each `src/**/*.ts` and `test/**/*.ts` file:

1. Match specifiers in `import ... from`, `export ... from`, side-effect `import '...'`, `import('...')`, and `vi.mock('...')` that start with `../`.
2. Resolve each against the file's directory.
3. A target under `src/` becomes `@/<rel>`. A target under `test/` becomes `@test/<rel>`. Anything else aborts the run.

It does NOT touch:

- `./` specifiers;
- `new URL('../catalog/', import.meta.url)` in `src/main.ts`;
- `join(import.meta.dirname, '..', ...)` in tests.

Then run `prettier --write` on the changed files, in the same commit.

Verification: `typecheck`, `test` (including the no-`../` guard), `build`, and `smoke:pack`.

## Testing Strategy

| Layer     | What                                             | Approach                                |
| --------- | ------------------------------------------------ | --------------------------------------- |
| Unit/arch | Import direction, no `../`, no `@test/` in `src` | Vitest regex guards                     |
| Build     | No alias leak                                    | `check-dist-aliases.mjs` inside `build` |
| E2E       | Published binary runs                            | `smoke-pack.mjs` in `prepublishOnly`    |

## Threat Matrix

| Boundary                 | Applicability               |
| ------------------------ | --------------------------- |
| Documentation-like paths | N/A: no file classification |
| Git repository selection | N/A: no git calls           |
| Commit state             | N/A                         |
| Push state               | N/A: pre-push is unchanged  |
| PR commands              | N/A                         |

The smoke script spawns `npm` and `node` with fixed argv and no shell, so no routing boundary is introduced.

## Migration / Rollout

No migration is required. Commit 1 contains the wiring, guards, scripts and canary conversions. Commit 2 contains the codemod and Prettier. Rollback means reverting commit 2, then commit 1.

## Open Questions

- [ ] Spike outcome for the `tsc-alias` and Vitest ladders; rung 4 of the tsc-alias ladder blocks the change.
- [ ] A stale `dist` is not cleaned before the build. Stale files could be packed; adding a clean step is out of scope unless the maintainer wants it.
