# Proposal: Rename dotagent to shitaku

## Intent

Rename the project to `shitaku` (issue #28) before the first npm publish, so name, package, binary, and state directory match.

## Scope

### In Scope

- Package `@jsisques/dotagent` -> `@jsisques/shitaku`; bin `dotagent-cli` -> `shitaku`; add `repository` (https://github.com/JSisques/shitaku)
- State dir `~/.claude/.dotagent/` -> `~/.claude/.shitaku/`, **no migration**: a deliberate breaking change on an unpublished package (`npm view @jsisques/dotagent` returns 404)
- Live files: `src`, `test`, `scripts/smoke-pack.mjs`, `README.md`, `package.json`, `package-lock.json` (via `npm install --package-lock-only`), `openspec/config.yaml`
- Delta specs for the 4 live specs
- Engram migration (non-code workstream)

### Out of Scope

- `openspec/changes/archive/*` (immutable history)
- Historical topic keys (`sdd/dotagent-mvp/*`)
- Hand edits to the Engram SQLite database
- State-dir migration or read fallback

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `module-resolution`: smoke check runs `shitaku --help`
- `install-safety`: backups and manifest under `~/.claude/.shitaku/`
- `mcp-install`: command is `shitaku init`
- `git-hooks`: `npx @jsisques/shitaku` behavior unchanged

## Approach

1. **Manual pre-step (user)**: `gh repo rename shitaku`, `git remote set-url`, optional local directory rename.
2. **Mechanical rename** of string literals; no structural change.
3. **Verify**: `npm run build`, `test`, `typecheck`, `format:check`, `smoke:pack`.
4. **Engram migration**:
   - (a) The new remote makes the derived key `shitaku`.
   - (b) Run `engram projects rescue-ownership --project shitaku --observation <id>` on ONE observation, then confirm `mem_search` finds it under `shitaku`.
   - (c) If that works, move the rest (about 54 observations, 6 sessions, 93 prompts).
   - (d) If it fails, start a fresh `shitaku` project (`sdd-init/shitaku`) and leave the history under `dotagent`.

Single PR (estimated well under 400 lines).

## Affected Areas

| Area                                                    | Layer                 | Impact                                                  |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| `src/**/journal.ts`                                     | Infrastructure        | State dir path                                          |
| `src/**/node-fs.ts`                                     | Infrastructure        | Temp-file suffix                                        |
| `src/**/program.ts`                                     | Driving adapter (CLI) | `.name('shitaku')`                                      |
| `test/**` (journal, program, architecture, `setup.ts`)  | Tests                 | Paths, argv, HOME prefix                                |
| `scripts/smoke-pack.mjs`                                | Tooling               | Bin path, `node_modules/@jsisques/shitaku`, temp prefix |
| `package.json`, `package-lock.json`                     | Build                 | name, bin, repository                                   |
| `README.md`, `openspec/config.yaml`, `openspec/specs/*` | Docs                  | Rename                                                  |

The domain layer is unaffected.

## Risks

| Risk                                          | Likelihood | Mitigation                                                |
| --------------------------------------------- | ---------- | --------------------------------------------------------- |
| `smoke-pack.mjs` path drift breaks prepublish | Med        | Run `smoke:pack` as a required check                      |
| Test HOME prefix out of sync with `setup.ts`  | Med        | Rename both together; run the full suite                  |
| `rescue-ownership` has no dry run             | Med        | Try one observation first; fall back to (d)               |
| Stale remote keeps the key `dotagent`         | Low        | Remote update is step 1; check with `mem_current_project` |

## Rollback Plan

- Code: revert the PR. Nothing was published, so no consumers are affected.
- Repo: `gh repo rename dotagent`, then `git remote set-url` back.
- Engram: run `rescue-ownership --project dotagent` with the same IDs; the fallback path leaves history untouched.

## Dependencies

- The GitHub repo rename and the remote update happen before the code change.
- The npm names (`@jsisques/shitaku`, bin `shitaku`) are available.

## Success Criteria

- [ ] Running `rg -i dotagent` outside `openspec/changes/archive` (and outside gitignored files) finds nothing
- [ ] build, test, typecheck, format:check, and smoke:pack pass
- [ ] `shitaku --help` exits 0 from the packed tarball
- [ ] Engram history is reachable under `shitaku`, or the fallback is documented
