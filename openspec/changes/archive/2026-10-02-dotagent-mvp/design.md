# Design: dotagent MVP (catalog + `init` for MCPs)

## Technical Approach

Hexagonal TypeScript ESM CLI. The pure domain (catalog model, profile resolution, `ChangePlan`, JSON merge, placeholder rules, manifest model) makes no I/O calls. The application use cases (`InitMcps`, `UndoInstall`) depend only on ports. Adapters implement the ports, and `src/main.ts` is the only module that touches `os`, `process`, or the package location. All writes go through a plan/apply split: we compute a `ChangePlan`, show it (with `--dry-run` we stop there), back up, write atomically, then record a manifest journal entry.

## Architecture Decisions

| Topic | Options | Tradeoff | Decision |
|---|---|---|---|
| Domain purity | (a) no deps at all; (b) pure libs allowed (`zod`, `node:path`, `node:crypto` hash) | (a) means duplicated types and handwritten validators | **(b)**: no `node:fs`, `node:os`, or `process` in `src/domain`, enforced by an architecture test |
| Types source | handwritten interfaces vs `z.infer` | handwritten types drift from the schema | **`z.infer`** from the domain schemas |
| Bundled vs folder source | two adapters vs one `FolderCatalogSource` | — | **One adapter**. Bundled means a folder resolved in `main.ts` via `new URL('../catalog/', import.meta.url)` |
| Ownership state | stored `owned` map vs derived from the journal | a stored map can drift from the journal | **Derived**: replay the non-undone installs |
| Undo order | any install vs LIFO per file | restoring an older backup out of order would clobber newer installs | **LIFO**: only the newest non-undone install for a file can be undone |
| User-scope write | `claude mcp add-json` subprocess vs direct merge | the subprocess adds a process boundary, needs `claude` on PATH, and gives no dry-run | **Direct merge** with backup, re-read, and atomic rename (approved hybrid) |
| Build | bundler vs plain `tsc` | a bundler adds tooling | **`tsc`** to `dist/`, keeping the shebang in `main.ts` |
| Profiles in MVP | `--profile` flag vs load+validate only | the proposal puts "applying profiles" out of scope | **Load+validate only** (extends, cycles, unknown refs); no CLI flag |
| Secret guard | schema-only vs schema plus a pre-write scan | schema-only misses copy-pasted tokens | **Both** |

## Directory Tree

```
src/
  main.ts                         # composition root (only os.homedir/process here)
  domain/
    catalog/schema.ts             # zod: McpItem, Profile, CatalogIndex
    catalog/profile.ts            # resolveProfile, validateProfiles
    placeholders.ts               # ${VAR} parse/validate, secret scan
    plan/change-plan.ts           # buildPlan -> ChangePlan
    json-merge.ts                 # mergeAtPath, detectIndent
    manifest.ts                   # zod Manifest, deriveOwnership
    hash.ts                       # sha256 of canonical JSON / bytes
  application/
    init-mcps.ts                  # plan() + apply()
    undo-install.ts
    journal.ts                    # load/save manifest via FileSystem
  ports/{agent-target,catalog-source,prompter,file-system,paths}.ts
  adapters/
    claude-code/target.ts
    catalog/folder-source.ts
    cli/program.ts                # commander; exported runCli(argv, deps)
    cli/clack-prompter.ts
    fs/node-fs.ts                 # atomic write
catalog/catalog.json, mcps/{github,context7}.json, profiles/{base,web}.json
test/setup.ts, test/architecture.test.ts, test/helpers/tmp-paths.ts
```

## Interfaces / Contracts

```ts
// domain/catalog/schema.ts
const VarName = /^[A-Z_][A-Z0-9_]*$/;
const EnvRef = z.object({ name: z.string().regex(VarName), required: z.boolean().default(true), description: z.string().optional() });
const Templated = z.string().refine(hasPlaceholder, 'must reference ${VAR}'); // headers + server.env values
const Server = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stdio'), command: z.string(), args: z.array(z.string()).default([]), env: z.record(Templated).optional() }),
  z.object({ type: z.enum(['http', 'sse']), url: z.string().url(), headers: z.record(Templated).optional() }),
]);
export const McpItemSchema = z.object({ name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), description: z.string(),
  server: Server, env: z.array(EnvRef).default([]), targets: z.array(z.string()).optional() })
  .superRefine(allPlaceholdersDeclared);
export const ProfileSchema = z.object({ name: z.string(), description: z.string().optional(),
  extends: z.array(z.string()).default([]), mcps: z.array(z.string()).default([]) });
export const CatalogIndexSchema = z.object({ version: z.literal(1),
  items: z.object({ mcps: z.array(z.string()), profiles: z.array(z.string()).default([]) }).passthrough() });

// domain/plan/change-plan.ts
type Action = 'create' | 'update' | 'skip' | 'conflict';
interface PlannedItem { name: string; action: Action; entry: McpServerEntry; reason?: string }
interface FileChange { path: string; scope: Scope; beforeHash: string | null; before: string | null; after: string; items: PlannedItem[] }
interface ChangePlan { files: FileChange[]; requiredEnv: string[] }

// ports
type Scope = 'project' | 'user';
interface Paths { homeDir: string; cwd: string }
interface AgentTarget { id: 'claude-code'; supports(i: McpItem): boolean; configPath(s: Scope, p: Paths): string;
  serversKeyPath(s: Scope): string[]; toEntry(i: McpItem): McpServerEntry }
interface CatalogSource { ref(): SourceRef; load(): Promise<Catalog> }   // SourceRef {kind:'bundled'|'folder', location}
interface FileSystem { readText(p: string): Promise<string | null>; writeAtomic(p: string, data: string): Promise<void>;
  remove(p: string): Promise<void>; mkdirp(p: string): Promise<void> }
interface Prompter { selectMcps(o: McpItem[]): Promise<string[]>; selectScope(): Promise<Scope>;
  resolveConflict(i: PlannedItem): Promise<'overwrite' | 'skip'>; confirm(plan: ChangePlan): Promise<boolean>; info(msg: string): void }
```

**Manifest** (`~/.claude/.dotagent/manifest.json`, one manifest for both scopes, absolute paths):
```json
{ "version": 1, "installs": [{ "id": "20261002T101500Z-a1b2", "createdAt": "ISO", "undoneAt": null,
  "source": { "kind": "bundled", "location": "...", "catalogVersion": 1 },
  "files": [{ "path": "/abs/.mcp.json", "scope": "project", "backup": "backups/<id>/0-mcp.json",
    "beforeHash": "sha256|null", "afterHash": "sha256",
    "items": [{ "kind": "mcp", "name": "github", "action": "create", "entryHash": "sha256" }] }] }] }
```
`backup` is `null` when the file did not exist before the install. Backups live at `~/.claude/.dotagent/backups/<installId>/<n>-<basename>`, hold the exact original bytes, and are never pruned in the MVP.

## Algorithms

**Profile resolution**: DFS over `extends`, with a `visiting` set for cycle detection (the error shows the cycle path, e.g. `a -> b -> a`). Parents come first, and mcp names are deduplicated in first-seen order. At load time, references to unknown profiles or mcps are errors.

**buildPlan**: for each selected item, `desired = target.toEntry(item)` and `current = servers[name]`:
- absent: `create`
- `hash(current) == hash(desired)`: `skip`
- owned (derived ownership has `entryHash == hash(current)`): `update`
- otherwise: `conflict`

Interactive mode resolves each conflict through the Prompter. `--yes` aborts with exit code 2 if conflicts remain, unless `--force` is set.

**JSON merge**: missing file means `{}`. An unparseable file, or a non-object root or servers map, aborts; the file is never overwritten. The merge replaces only `doc[...keyPath][name]` and leaves every other key and its insertion order intact. New names are appended. Indentation is detected from the original (default 2), and a trailing newline is kept.

**Apply**:
1. Re-read each file; if its hash is not `beforeHash`, re-plan once against the fresh content. If the actions changed, abort with "file changed, re-run".
2. Scan for secret literals: abort if the value of any declared env var from the injected env appears in `after`.
3. Write the backup.
4. `writeAtomic`: write a tmp file in the same directory (`.<base>.dotagent-<rand>.tmp`), copy the existing mode, fsync, rename.
5. Append to the journal (also written atomically).

User scope prints a "close Claude Code" warning before confirming.

**Placeholders**: we emit catalog strings verbatim. We never read env values when writing; they are used only by the leak scan and by the "missing env" hint. `${VAR:-default}` is allowed, but defaults are not permitted in `headers`.

**Undo** (`undo [--id] [--force] [--dry-run]`):
1. Select the newest non-undone install, or the one given by `--id` only if it is the newest for each of its files.
2. For each file, check the current hash against `afterHash`. On mismatch, refuse with exit code 3 unless `--force` is set.
3. Restore the backup bytes atomically, or remove the file if `backup` is null.
4. Verify that the restored hash equals `beforeHash`.
5. Set `undoneAt`.

## Data Flow

```
argv -> cli/program -> InitMcps.plan(sel) <- CatalogSource.load
                           |  FileSystem.readText + journal ownership
                           v
                       ChangePlan -> Prompter.confirm / --dry-run print (stop)
                           v
                     InitMcps.apply -> re-read, leak scan, backup, writeAtomic, journal
```

## Package Essentials

`name @jsisques/dotagent`, `type: module`, `bin: { "dotagent-cli": "./dist/main.js" }`, `files: ["dist", "catalog", "README.md"]`, `engines.node: ">=22"`, `publishConfig.access: public`. Scripts: `build` (tsc), `typecheck`, `test` (`vitest run`), and `prepublishOnly` (all three). Dependencies: `commander`, `@clack/prompts`, `zod`. Dev dependencies: `typescript`, `vitest`, `@types/node`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | schema, profiles/cycles, buildPlan, merge, placeholders, deriveOwnership | pure functions with fixtures |
| Integration | node-fs atomic write, apply, backup, undo byte-equality, re-read race | temp dirs via `fs.mkdtemp`; `Paths` points into the temp dir |
| CLI | `runCli(argv, deps)` with a fake Prompter | in-process run; asserts on the plan output and exit codes |
| Guards | real home is never touched; domain stays pure; no secret literals | `test/setup.ts` uses `vi.mock('node:os')` so `homedir` throws and sets `HOME` to a temp dir; `architecture.test.ts` scans `src/` for forbidden imports and for `homedir` outside `main.ts`; a leak test injects env values and asserts they are absent from the output |

## File Changes / Chained PR Slices (400-line budget)

| # | Slice | Files | Est. lines |
|---|---|---|---|
| 1 | Scaffold + tooling | package.json, tsconfig*.json, vitest.config.ts, .gitignore, test/setup.ts, test/architecture.test.ts, test/helpers, src/main.ts stub, README note | ~170 |
| 2 | Catalog | domain/catalog/*, domain/placeholders.ts, ports/catalog-source.ts, adapters/catalog/folder-source.ts, catalog/**, tests | ~380 |
| 3 | Plan + project writer | domain/plan, json-merge, hash, ports/{agent-target,file-system,paths}, adapters/claude-code, adapters/fs/node-fs, application/init-mcps (apply, no backup), tests | ~390 |
| 4 | User scope + safety | domain/manifest.ts, application/journal.ts, undo-install.ts, backup + re-read in init-mcps, user scope in target, tests | ~400 |
| 5 | CLI | adapters/cli/*, ports/prompter.ts, main.ts wiring, README usage, CLI tests | ~360 |

## Threat Matrix

N/A: the product code has no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Note that catalog stdio `command` entries are written as data and are executed later by Claude Code. That makes `--source` a trust boundary, which the README documents.

## Migration / Rollout

No migration required (greenfield). Before release, manually verify `${VAR}` expansion in `~/.claude.json`.

## Open Questions

- [ ] Does `${VAR}` expand in user-scope `~/.claude.json`? This blocks recommending user scope for http headers.
- [ ] Should the MCP picker preselect from a profile, or is that "applying profiles"? The design currently says no.
- [ ] Do the parallel specs use the same `catalog.json` shape (`items.mcps`/`items.profiles`)? The two must be reconciled before tasks are written.
