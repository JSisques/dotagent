```yaml
change: add-list-command
mode: hybrid
strict_tdd: true
verdict: PASS WITH WARNINGS
requirements: 6
scenarios: 15
compliant: 15
critical: 0
warning: 1
suggestion: 2
commands:
  typecheck: 0
  lint: 0
  format_check: 0
  test: 0 (25 files, 397 tests)
  build: 0
```

# Verification Report: add-list-command

Verdict: PASS WITH WARNINGS. All 15 scenarios are covered by passing tests; all 5 gates are green; all tasks are checked.

## Spec compliance (covering tests, program.test.ts `list` unless noted)

| Scenario                        | Covering test                                                             | Result    |
| ------------------------------- | ------------------------------------------------------------------------- | --------- |
| No kind lists all               | text: groups by kind with one aligned name column...                      | COMPLIANT |
| Single kind                     | text: lists only the requested kind                                       | COMPLIANT |
| Invalid kind                    | rejects an invalid kind with the allowed choices, exit 1 and empty stdout | COMPLIANT |
| Match on description            | text: searches descriptions case-insensitively                            | COMPLIANT |
| Match on name, narrowed by kind | text: searches names and combines with the kind filter                    | COMPLIANT |
| Grouped and aligned             | text: groups by kind with one aligned name column...                      | COMPLIANT |
| Multi-line description          | same test (github-tools 'GitHub\n tools' -> 'GitHub tools')               | COMPLIANT |
| Profile without description     | text: lists only profiles when asked...                                   | COMPLIANT |
| No match                        | text: prints no matching items and exits 0                                | COMPLIANT |
| No match in JSON                | json: prints an empty items list and exits 0                              | COMPLIANT |
| Sorted flat shape               | json: prints one versioned document with flat items sorted...             | COMPLIANT |
| Null description                | same json test (base -> null)                                             | COMPLIANT |
| Custom source                   | all --source tests (fullCatalog fixture)                                  | COMPLIANT |
| Warnings keep JSON pure         | json: warns on stderr about skipped entries while stdout stays parseable  | COMPLIANT |
| Load failure                    | load failure: missing folder (text/json), malformed catalog.json          | COMPLIANT |

Domain/application unit tests (listing.test.ts, list-catalog.test.ts) and the architecture guard pass.

## Runtime smoke (after build)

- `list`: grouped, exit 0. `list --json`: version 1, flat sorted. `list skills --search x`: only example-skill. `list bogus`: exit 1, "Allowed choices are mcps, skills, profiles." `list --search zzz-nothing`: "no matching items", exit 0. `--json` empty: items []. `--source /nonexistent`: error line, exit 1.

## Strict TDD

Apply-progress has RED/GREEN/triangulate/refactor evidence per task, test files exist and pass. Note: table is not in the exact column format of the template (no emoji markers) but content is complete.

## Design coherence

All decisions followed (listing.ts, CatalogLoadError, commander choices, global name width, singular JSON kinds, no main.ts/port changes). Design open question (singular kinds, group order mcp/profile/skill) is resolved by implementation and README.

## Issues

CRITICAL: none.
WARNING:

1. README.md ### List text example (README.md around the `mcps:` code block) shows name width 8, but real output uses one global width across all groups (bundled output pads to 13 because of `example-skill`), and omits the skills group. Fix: paste real `node dist/main.js list` output.
   SUGGESTION:
1. design.md Open Questions checkbox is still unchecked; tick it before archive.
1. tasks.md "Chain strategy: pending" forecast header is stale after the split; update before archive.
