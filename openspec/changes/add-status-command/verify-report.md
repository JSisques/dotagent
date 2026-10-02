# Verify Report: add-status-command (PR 1 only, tasks 1.1-1.5)

Verdict: PASS. CRITICAL 0, WARNING 1, SUGGESTION 1.

- pnpm test: 293/294; only test/tooling.test.ts "lint gate" timed out (5000ms) under parallel load. Rerun alone: 8/8 pass (flaky, not a regression).
- typecheck, lint, format:check: clean.
- classifyStatus (src/domain/plan/status-plan.ts:26-32) matches design.md:37 precedence exactly.
- deriveOwnedItems (src/domain/manifest.ts:108-127): undone excluded, newest wins with installId, key = scope+path+name, skills use item.root so listed once.
- readPresent moved unchanged to src/application/skill-tree.ts; init-mcps.ts imports it. deriveOwnership/deriveSkillOwnership untouched.
- Size: 189 added / 20 deleted non-openspec lines (~209), under 400.
- TDD evidence in apply-progress.md is complete (RED/GREEN/triangulate/refactor).

WARNING: test/tooling.test.ts:46 default 5s timeout flaky under full-suite parallelism.
SUGGESTION: src/domain/manifest.ts now imports a type from '@/ports' (domain -> ports, type-only); architecture test passes, but confirm intended.
