# Apply Progress: add-status-command

Mode: Strict TDD. Delivery: stacked-to-main, ask-on-risk.

## PR 1: Domain foundation (complete)

- [x] 1.1 RED `test/domain/plan/status-plan.test.ts` (11 cases)
- [x] 1.2 GREEN `src/domain/plan/status-plan.ts`
- [x] 1.3 RED `test/domain/manifest.test.ts` `deriveOwnedItems` (6 cases)
- [x] 1.4 GREEN `OwnedItem`, `deriveOwnedItems` in `src/domain/manifest.ts`
- [x] 1.5 REFACTOR `readPresent` moved to `src/application/skill-tree.ts`

### TDD Cycle Evidence

| Task    | Test File                              | Layer | Safety Net     | RED                                  | GREEN          | TRIANGULATE | REFACTOR                  |
| ------- | -------------------------------------- | ----- | -------------- | ------------------------------------ | -------------- | ----------- | ------------------------- |
| 1.1/1.2 | `test/domain/plan/status-plan.test.ts` | Unit  | N/A (new)      | Failed: module missing               | 11/11 passed   | 11 cases    | Clean                     |
| 1.3/1.4 | `test/domain/manifest.test.ts`         | Unit  | 15/15 baseline | 6 failed: `deriveOwnedItems` missing | 21/21 passed   | 6 cases     | Clean                     |
| 1.5     | init-mcps + architecture tests         | Unit  | 133 passing    | N/A (pure move; existing tests)      | 150/150 passed | N/A         | Move only, body unchanged |

### Work Unit Evidence

| Evidence             | Value                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/domain test/application/init-mcps.test.ts test/architecture.test.ts`: 11 files, 150 passed |
| Runtime harness      | N/A: no caller yet                                                                                                    |
| Rollback boundary    | `status-plan.ts`, `skill-tree.ts`, `deriveOwnedItems` block; move `readPresent` back into `init-mcps.ts`              |

Full suite: 21 files, 294 tests passed. typecheck, lint, format:check clean.
