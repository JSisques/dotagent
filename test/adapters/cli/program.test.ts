import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '../../../src/adapters/catalog/folder-source.js';
import { runCli, type CliDeps } from '../../../src/adapters/cli/program.js';
import { claudeCodeTarget } from '../../../src/adapters/claude-code/target.js';
import { NodeFileSystem } from '../../../src/adapters/fs/node-fs.js';
import { PromptCancelled, type Prompter } from '../../../src/ports/prompter.js';
import { makeTmpPaths, type TmpPaths } from '../../helpers/tmp-paths.js';

const CATALOG = join(import.meta.dirname, '..', '..', '..', 'catalog');
const TOKEN = 'abc123-secret-value';

/** Scripted prompter; any call it was not scripted for fails the test. */
function fakePrompter(
  script: Partial<Record<'mcps' | 'scope' | 'confirm', unknown>> & { conflict?: 'overwrite' | 'skip' } = {},
) {
  const calls: string[] = [];
  const unscripted = (name: string): never => {
    throw new Error(`unexpected prompt: ${name}`);
  };
  const prompter: Prompter = {
    selectMcps: async () => (calls.push('mcps'), (script.mcps as string[] | undefined) ?? unscripted('mcps')),
    selectScope: async () => (
      calls.push('scope'),
      (script.scope as 'project' | 'user' | undefined) ?? unscripted('scope')
    ),
    resolveConflict: async () => (calls.push('conflict'), script.conflict ?? unscripted('conflict')),
    confirm: async () => (calls.push('confirm'), (script.confirm as boolean | undefined) ?? unscripted('confirm')),
    info: () => {},
  };
  return { prompter, calls };
}

describe('runCli', () => {
  let tmp: TmpPaths;
  let out: string[];
  let err: string[];
  let prompter: Prompter;
  let calls: string[];
  let env: Record<string, string | undefined>;
  const mcpFile = () => join(tmp.cwd, '.mcp.json');
  const text = () => [...out, ...err].join('\n');

  const run = (...args: string[]) => {
    const deps: CliDeps = {
      makeSource: (folder) => new FolderCatalogSource(folder ?? CATALOG, folder ? 'folder' : 'bundled'),
      fs: new NodeFileSystem(),
      target: claudeCodeTarget,
      paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
      env,
      prompter,
      out: (l) => out.push(l),
      err: (l) => err.push(l),
    };
    return runCli(['node', 'dotagent-cli', ...args], deps);
  };
  const usePrompter = (script?: Parameters<typeof fakePrompter>[0]) => ({ prompter, calls } = fakePrompter(script));

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    out = [];
    err = [];
    env = { GITHUB_TOKEN: TOKEN };
    usePrompter();
  });
  afterEach(() => tmp.cleanup());

  it('prints help and exits 0', async () => {
    expect(await run('--help')).toBe(0);
    expect(text()).toContain('init');
    expect(text()).toContain('undo');
  });

  it('installs without prompting when --mcps and --scope are given', async () => {
    expect(await run('init', '--mcps', 'github', '--scope', 'project')).toBe(0);
    expect(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers.github.type).toBe('http');
    expect(calls).toEqual([]);
  });

  it('prompts for MCPs, scope and confirmation interactively', async () => {
    usePrompter({ mcps: ['context7'], scope: 'project', confirm: true });
    expect(await run('init')).toBe(0);
    expect(calls).toEqual(['mcps', 'scope', 'confirm']);
    expect(Object.keys(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers)).toEqual(['context7']);
  });

  it('writes nothing when the confirmation is declined', async () => {
    usePrompter({ mcps: ['context7'], scope: 'project', confirm: false });
    expect(await run('init')).toBe(0);
    await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  it('exits 1 when a prompt is cancelled', async () => {
    prompter.selectMcps = async () => {
      throw new PromptCancelled();
    };
    expect(await run('init')).toBe(1);
    expect(text()).toContain('cancelled');
  });

  it('exits non-zero naming an unknown MCP and writes nothing', async () => {
    expect(await run('init', '--mcps', 'ghost', '--scope', 'project')).toBe(1);
    expect(text()).toContain('ghost');
    expect(await readdir(tmp.cwd)).toEqual([]);
  });

  it('requires --mcps and --scope with --yes', async () => {
    expect(await run('init', '--yes', '--mcps', 'github')).toBe(1);
    expect(text()).toContain('--scope');
    expect(calls).toEqual([]);
  });

  it('prints the plan and touches nothing on --dry-run', async () => {
    expect(await run('init', '--mcps', 'github', '--scope', 'user', '--dry-run')).toBe(0);
    expect(text()).toMatch(/github.*create/);
    expect(text()).toContain('close Claude Code');
    expect(await readdir(tmp.homeDir)).toEqual([]);
  });

  describe('conflicts', () => {
    const existing = { mcpServers: { github: { type: 'stdio', command: 'mine' } } };
    beforeEach(() => writeFile(mcpFile(), JSON.stringify(existing)));

    it('exits 2 with --yes and leaves the file alone', async () => {
      expect(await run('init', '--yes', '--mcps', 'github', '--scope', 'project')).toBe(2);
      expect(JSON.parse(await readFile(mcpFile(), 'utf8'))).toEqual(existing);
      expect(text()).toContain('--force');
    });

    it('exits 2 in flag-only mode instead of prompting', async () => {
      expect(await run('init', '--mcps', 'github', '--scope', 'project')).toBe(2);
      expect(calls).toEqual([]);
    });

    it('overwrites with --force', async () => {
      expect(await run('init', '--yes', '--force', '--mcps', 'github', '--scope', 'project')).toBe(0);
      expect(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers.github.type).toBe('http');
    });

    it('asks per conflict interactively and honours skip', async () => {
      usePrompter({ mcps: ['github', 'context7'], scope: 'project', conflict: 'skip', confirm: true });
      expect(await run('init')).toBe(0);
      const servers = JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers;
      expect(servers.github.command).toBe('mine');
      expect(servers.context7).toBeDefined();
      expect(calls).toContain('conflict');
    });

    it('asks per conflict interactively and honours overwrite', async () => {
      usePrompter({ mcps: ['github'], scope: 'project', conflict: 'overwrite', confirm: true });
      expect(await run('init')).toBe(0);
      expect(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers.github.type).toBe('http');
    });
  });

  describe('env values', () => {
    it('warns about unset variables by name only', async () => {
      env = {};
      await run('init', '--mcps', 'github', '--scope', 'project', '--dry-run');
      expect(text()).toContain('GITHUB_TOKEN');
      expect(text()).toMatch(/not set/i);
    });

    it('never leaks a value into output or written files', async () => {
      await run('init', '--mcps', 'github', '--scope', 'user');
      await run('init', '--mcps', 'github', '--scope', 'project', '--dry-run');
      await run('undo', '--dry-run');
      expect(text()).not.toContain(TOKEN);
      const files = [join(tmp.homeDir, '.claude.json'), join(tmp.homeDir, '.claude', '.dotagent', 'manifest.json')];
      for (const f of files) expect(await readFile(f, 'utf8')).not.toContain(TOKEN);
    });
  });

  describe('--source', () => {
    it('reads a custom folder', async () => {
      const dir = join(tmp.root, 'custom');
      await mkdir(join(dir, 'mcps'), { recursive: true });
      await writeFile(join(dir, 'catalog.json'), JSON.stringify({ version: 1, items: { mcps: ['mine'] } }));
      await writeFile(
        join(dir, 'mcps', 'mine.json'),
        JSON.stringify({ name: 'mine', description: 'd', server: { type: 'stdio', command: 'x' } }),
      );
      expect(await run('init', '--source', dir, '--mcps', 'mine', '--scope', 'project')).toBe(0);
      expect(JSON.parse(await readFile(mcpFile(), 'utf8')).mcpServers.mine.command).toBe('x');
    });

    it('explains a malformed catalog.json instead of a stack trace', async () => {
      const dir = join(tmp.root, 'broken');
      await mkdir(dir);
      await writeFile(join(dir, 'catalog.json'), '{ not json');
      expect(await run('init', '--source', dir, '--mcps', 'x', '--scope', 'project')).toBe(1);
      expect(text()).toContain('cannot load catalog');
      expect(text()).toContain(dir);
      expect(text()).not.toContain('SyntaxError');
    });

    it('explains a missing source folder', async () => {
      expect(await run('init', '--source', join(tmp.root, 'nope'), '--mcps', 'x', '--scope', 'project')).toBe(1);
      expect(text()).toContain('cannot load catalog');
    });
  });

  describe('undo', () => {
    it('restores the original and reports it', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      expect(await run('undo')).toBe(0);
      await expect(readFile(mcpFile(), 'utf8')).rejects.toThrow();
      expect(text()).toMatch(/undone|restored/i);
    });

    it('reports nothing to undo without a manifest', async () => {
      expect(await run('undo')).toBe(0);
      expect(text()).toMatch(/nothing to undo/i);
    });

    it('exits 3 when a file changed since install, and --force restores it', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      await writeFile(mcpFile(), '{"edited":true}');
      expect(await run('undo')).toBe(3);
      expect(await readFile(mcpFile(), 'utf8')).toBe('{"edited":true}');
      expect(await run('undo', '--force')).toBe(0);
    });

    it('does not change anything on --dry-run', async () => {
      await run('init', '--mcps', 'github', '--scope', 'project');
      const before = await readFile(mcpFile(), 'utf8');
      expect(await run('undo', '--dry-run')).toBe(0);
      expect(await readFile(mcpFile(), 'utf8')).toBe(before);
    });

    it('exits 1 for an unknown --id', async () => {
      expect(await run('undo', '--id', 'nope')).toBe(1);
      expect(text()).toContain('nope');
    });
  });
});
