# Apply Progress: update-notifier (issue #49)

## PR 1 (domain, port, use case): complete

Branch: `feat/update-notifier-core`. Mode: strict TDD (RED confirmed by missing-module failure before each GREEN).

- [x] 1.1-1.3 `src/domain/update.ts` with `test/domain/update.test.ts` (39 cases).
- [x] 2.1 `src/ports/version-source.ts`.
- [x] 2.2-2.4 `src/application/check-update.ts` with `test/application/check-update.test.ts`.

Deviation from design: the use case races the source against the abort signal (`withAbort`), so a source that ignores the signal still cannot hold the command past `timeoutMs`.

Verification: typecheck, lint, format:check, test (25 files, 421 tests), build all green.

## Remaining (PR 2)

Phases 3-5: npm adapter, CLI wiring, `main.ts`, README.
