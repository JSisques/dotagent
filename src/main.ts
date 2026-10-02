#!/usr/bin/env node
// Composition root: the only module that touches os.homedir, process and the package location.
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FolderCatalogSource } from './adapters/catalog/folder-source.js';
import { ClackPrompter } from './adapters/cli/clack-prompter.js';
import { runCli } from './adapters/cli/program.js';
import { claudeCodeTarget } from './adapters/claude-code/target.js';
import { NodeFileSystem } from './adapters/fs/node-fs.js';

const cwd = process.cwd();
const bundled = fileURLToPath(new URL('../catalog/', import.meta.url));

process.exitCode = await runCli(process.argv, {
  makeSource: (folder) =>
    folder ? new FolderCatalogSource(resolve(cwd, folder), 'folder') : new FolderCatalogSource(bundled, 'bundled'),
  fs: new NodeFileSystem(),
  target: claudeCodeTarget,
  paths: { homeDir: homedir(), cwd },
  env: process.env,
  prompter: new ClackPrompter(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
