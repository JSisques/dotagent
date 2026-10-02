import { Command, CommanderError, Option } from 'commander';
import { planInit, applyPlan, LeakError, StaleFileError, UnknownMcpError } from '../../application/init-mcps.js';
import type { InitDeps } from '../../application/init-mcps.js';
import { undoInstall, UndoSelectionError, UndoVerifyError } from '../../application/undo-install.js';
import { ConfigError } from '../../domain/json-merge.js';
import type { ChangePlan } from '../../domain/plan/change-plan.js';
import type { AgentTarget, Scope } from '../../ports/agent-target.js';
import type { CatalogSource } from '../../ports/catalog-source.js';
import type { FileSystem } from '../../ports/file-system.js';
import type { Paths } from '../../ports/paths.js';
import { PromptCancelled } from '../../ports/prompter.js';
import type { Prompter } from '../../ports/prompter.js';

/** Everything the CLI touches, injected by the composition root (or by tests). */
export interface CliDeps {
  /** Builds the catalog source: the bundled catalog by default, or the folder given by `--source`. */
  makeSource(folder?: string): CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  env: Record<string, string | undefined>;
  prompter: Prompter;
  out(line: string): void;
  err(line: string): void;
  now?: () => Date;
}

interface InitOptions {
  mcps?: string[];
  scope?: Scope;
  source?: string;
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
}

/** Exit codes: 0 ok, 1 error, 2 unresolved conflicts, 3 undo refused. */
const EXIT_CONFLICT = 2;

function printPlan(deps: CliDeps, plan: ChangePlan): void {
  for (const file of plan.files) {
    deps.out(`${file.scope} scope: ${file.path}`);
    for (const item of file.items) deps.out(`  ${item.name}: ${item.action}${item.reason ? ` (${item.reason})` : ''}`);
  }
  for (const v of plan.requiredEnv)
    deps.out(v.set ? `env ${v.name}: set` : `warning: ${v.name} is not set; set it before using the server`);
}

async function runInit(deps: CliDeps, opts: InitOptions): Promise<number> {
  const nonInteractive = opts.yes === true || (opts.mcps !== undefined && opts.scope !== undefined);
  if (nonInteractive && (opts.mcps === undefined || opts.scope === undefined)) {
    deps.err('error: --yes requires both --mcps and --scope');
    return 1;
  }
  const source = deps.makeSource(opts.source);
  const initDeps: InitDeps = {
    source,
    fs: deps.fs,
    target: deps.target,
    paths: deps.paths,
    env: deps.env,
    now: deps.now,
  };
  const where = opts.source ?? 'the bundled catalog';
  let catalog;
  try {
    catalog = await source.load();
  } catch (e) {
    deps.err(`error: cannot load catalog from ${where}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  for (const issue of catalog.issues) deps.err(`warning: skipped ${issue.file}: ${issue.reason}`);

  const mcps = opts.mcps ?? (await deps.prompter.selectMcps(catalog.mcps));
  const scope = opts.scope ?? (await deps.prompter.selectScope());
  let force = opts.force === true;
  let plan = await planInit(initDeps, { mcps, scope, force });

  const conflicts = plan.files.flatMap((f) => f.items.filter((i) => i.action === 'conflict'));
  if (conflicts.length > 0) {
    if (nonInteractive) {
      for (const c of conflicts) deps.err(`conflict: '${c.name}' already exists with different content`);
      deps.err('error: unresolved conflicts; re-run with --force to overwrite them');
      return EXIT_CONFLICT;
    }
    const keep = new Set(mcps);
    for (const c of conflicts) {
      if ((await deps.prompter.resolveConflict(c)) === 'skip') keep.delete(c.name);
      else force = true;
    }
    plan = await planInit(initDeps, { mcps: mcps.filter((m) => keep.has(m)), scope, force });
  }

  printPlan(deps, plan);
  if (scope === 'user')
    deps.out('note: close Claude Code before applying, it may rewrite ~/.claude.json while running');
  if (opts.dryRun) {
    deps.out('dry run: nothing was written');
    return 0;
  }
  if (!nonInteractive && !(await deps.prompter.confirm(plan))) {
    deps.out('aborted: nothing was written');
    return 0;
  }
  deps.out((await applyPlan(initDeps, plan, { force })) ? 'done' : 'nothing to change');
  return 0;
}

async function runUndo(deps: CliDeps, opts: { id?: string; force?: boolean; dryRun?: boolean }): Promise<number> {
  const result = await undoInstall({ fs: deps.fs, paths: deps.paths, now: deps.now }, opts);
  switch (result.status) {
    case 'nothing':
      deps.out('nothing to undo');
      break;
    case 'already-undone':
      deps.out(`install ${result.installId} was already undone`);
      break;
    case 'refused':
      for (const f of result.changed) deps.err(`changed since install: ${f}`);
      deps.err('error: refusing to undo; re-run with --force to restore anyway');
      break;
    case 'dry-run':
      deps.out(`dry run: would restore ${result.files.join(', ')}`);
      break;
    case 'undone':
      deps.out(`undone install ${result.installId}: restored ${result.files.join(', ')}`);
      break;
  }
  return result.exitCode;
}

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  let exitCode = 0;
  const strip = (s: string): string => s.replace(/\n$/, '');
  const program = new Command()
    .name('dotagent-cli')
    .description('Install curated AI agent configuration from a catalog.')
    .exitOverride()
    .configureOutput({ writeOut: (s) => deps.out(strip(s)), writeErr: (s) => deps.err(strip(s)) });

  program
    .command('init')
    .description('Install MCP servers into a Claude Code config file')
    .option('--mcps <names>', 'comma-separated MCP names', csv)
    .addOption(new Option('--scope <scope>', 'where to install').choices(['project', 'user']))
    .option('--source <folder>', 'use a catalog folder instead of the bundled one (trusted: its commands run later)')
    .option('--dry-run', 'print the plan without writing anything')
    .option('--yes', 'skip confirmation (requires --mcps and --scope)')
    .option('--force', 'overwrite existing entries that differ')
    .action(async (opts: InitOptions) => void (exitCode = await guarded(deps, () => runInit(deps, opts))));

  program
    .command('undo')
    .description('Restore the files changed by the last install')
    .option('--id <id>', 'install id to undo (must be the newest for its files)')
    .option('--force', 'restore even if files changed since the install')
    .option('--dry-run', 'show what would be restored')
    .action(
      async (opts: { id?: string; force?: boolean; dryRun?: boolean }) =>
        void (exitCode = await guarded(deps, () => runUndo(deps, opts))),
    );

  try {
    await program.parseAsync(argv);
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode;
    throw e;
  }
  return exitCode;
}

/** Turns expected failures into a message and exit code 1; unknown errors still propagate. */
async function guarded(deps: CliDeps, run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch (e) {
    const known = [
      UnknownMcpError,
      StaleFileError,
      LeakError,
      ConfigError,
      UndoSelectionError,
      UndoVerifyError,
      PromptCancelled,
    ];
    if (e instanceof Error && known.some((k) => e instanceof k)) {
      deps.err(`error: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
