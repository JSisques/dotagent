# Apply Progress: update-notifier (issue #49)

## PR 1 (domain, port, use case): complete

Branch: `feat/update-notifier-core`. Mode: strict TDD (RED confirmed by missing-module failure before each GREEN).

- [x] 1.1-1.3 `src/domain/update.ts` with `test/domain/update.test.ts` (39 cases).
- [x] 2.1 `src/ports/version-source.ts`.
- [x] 2.2-2.4 `src/application/check-update.ts` with `test/application/check-update.test.ts`.

Deviation from design: the use case races the source against the abort signal (`withAbort`), so a source that ignores the signal still cannot hold the command past `timeoutMs`.

Verification: typecheck, lint, format:check, test (25 files, 421 tests), build all green.

Phases 3-5: npm adapter, CLI wiring, `main.ts`, README.

## PR 2 (adapter, CLI wiring, README): complete

Branch: `feat/update-notifier-wiring` (stacked on `feat/update-notifier-core`). Mode: strict TDD (RED confirmed before each GREEN: missing module for the adapter, 3 failing CLI cases before `program.ts`).

- [x] 3.1-3.2 `src/adapters/npm/registry-version-source.ts` with `test/adapters/npm/registry-version-source.test.ts` (7 cases).
- [x] 4.1-4.2 `UpdateSettings` and start/await/print in `src/adapters/cli/program.ts`; 5 new cases in `test/adapters/cli/program.test.ts` (`updates` stays optional).
- [x] 4.3 `src/main.ts` reads the version at runtime, `interactive` = stdout and stderr TTY, `updates` omitted if the version is unreadable.
- [x] 4.4 `test/naming.test.ts` and `test/architecture.test.ts` still pass.
- [x] 5.1 README "Update notifications" section.
- [x] 5.2 Manual: `curl -s 'https://registry.npmjs.org/@jsisques%2Fshitaku/latest'` returns JSON with `name` `@jsisques/shitaku` and `version` `0.2.0`; URL shape confirmed.
- [x] 5.3 typecheck, lint, format:check, test, build and smoke:pack green.
- [x] 5.4 Conventional commits per unit, no AI attribution.

Notes: the notice also prints after `--help` (CommanderError path), as designed. No TTY run of the built CLI was done (non-interactive environment); the TTY path is covered by `interactive: true` tests.
