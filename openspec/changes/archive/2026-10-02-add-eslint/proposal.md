# Proposal: Add ESLint with typescript-eslint (issue #29)

## Intent

The repo has no linter; issue #26 (PR workflow) needs a `pnpm lint` gate. typescript-eslint peers `typescript <6.1.0`, but the repo uses `typescript ^7.0.2`, so type-aware linting needs a dual-compiler setup (confirmed decision).

## Scope

### In Scope

- Dual compiler: `typescript` pinned to 6.x (for typescript-eslint only); native TS 7 compiler (`@typescript/native-preview` / `tsgo`) for `typecheck` and `build`.
- `eslint.config.js` flat config: `@eslint/js` + `typescript-eslint` `recommendedTypeChecked`, `projectService`, `eslint-config-prettier` last.
- Overrides: relaxed rules in `test/**` only where justified; `scripts/*.mjs` and `eslint.config.js` use `disableTypeChecked` + `globals.node`. Ignore `dist`, `coverage`, `node_modules`, `openspec`.
- `lint` script (plus `lint:fix`); lint-staged `"*.{ts,mjs,js}": ["eslint --fix", "prettier --write"]`.
- Fix or justify (inline disable with reason) all existing violations.

### Out of Scope

- `strictTypeChecked` preset; CI workflow (#26); `eslint-plugin-prettier`; returning to a single compiler (revisit at TS 7.1).

## Capabilities

### New Capabilities

- `lint-tooling`: lint gate behavior (`pnpm lint` exit codes, type-aware rules on `src/`, overrides for tests/scripts, pre-commit integration, compiler split).

### Modified Capabilities

None

## Approach

Install `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `typescript@~6.0`, and the native TS 7 package. Repoint `typecheck`/`build` from `tsc` to `tsgo`. Strict TDD: RED = `pnpm lint` fails on existing violations (or a deliberate bad fixture); GREEN = fixes until it passes.

**tsc-alias / build implications**: `build` runs `tsc -p ... && tsc-alias -p ... && node scripts/check-dist-aliases.mjs`. After the split, the `tsc` bin resolves to TS 6, so `build` must call `tsgo` explicitly. tsc-alias only rewrites emitted paths, but whether it requires the `typescript` package at runtime must be verified; `check-dist-aliases.mjs` stays as the safety net.

## Affected Areas

| Area                                 | Impact            | Description                                            |
| ------------------------------------ | ----------------- | ------------------------------------------------------ |
| `package.json`                       | Modified          | devDeps, scripts, lint-staged                          |
| `eslint.config.js`                   | New               | flat config                                            |
| `tsconfig.json`                      | Possibly modified | include for linted files                               |
| `src/**`, `test/**`, `scripts/*.mjs` | Modified          | violation fixes                                        |
| Hexagonal layers                     | None              | tooling only; no domain/ports/adapters behavior change |

## Risks

| Risk                                                                                                               | Likelihood | Mitigation                                          |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------- |
| `tsc` bin ambiguity; build/typecheck silently on TS 6                                                              | Med        | explicit `tsgo` in scripts; verify version in apply |
| Native TS 7 package name/stability (`@typescript/native-preview` vs `typescript@7` alias with colliding `tsc` bin) | Med        | resolve in design                                   |
| tsc-alias depends on `typescript` package                                                                          | Low        | verify; `check-dist-aliases.mjs` catches breakage   |
| TS 6 vs 7 type-check divergence                                                                                    | Low        | `typecheck` with tsgo remains source of truth       |
| Violation count above estimate; slower commits                                                                     | Med        | inline justifications; `projectService`             |
| Diff exceeds 400 lines (lockfile excluded)                                                                         | Low        | forecast in tasks                                   |

## Rollback Plan

Revert the PR: removes `eslint.config.js`, ESLint devDeps, `lint` scripts, lint-staged entry, and restores `typescript ^7.0.2` and `tsc` scripts; regenerate `pnpm-lock.yaml`.

## Dependencies

- typescript-eslint peer range (ESLint major) checked at apply time. Blocks #26.

## Success Criteria

- [ ] `pnpm lint` exits 0 on the repo and non-zero on a type-aware violation in `src/`.
- [ ] `pnpm run typecheck`, `pnpm test`, `pnpm run build`, `pnpm run format:check` pass using the native TS 7 compiler.
- [ ] Pre-commit runs `eslint --fix` on staged TS/JS files.
- [ ] Every remaining disable comment has a written reason.
