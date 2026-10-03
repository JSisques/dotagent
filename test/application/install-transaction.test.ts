import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import {
  backupPath,
  newInstallId,
  restoreBytes,
  restoreText,
  rollback,
  StaleFileError,
} from '@/application/install-transaction.js';
import * as initMcps from '@/application/init-mcps.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

describe('backupPath', () => {
  it('formats backups/{id}/{n}-{basename}', () => {
    expect(backupPath('20261003T101500-ab12', 0, '/p/.mcp.json')).toBe('backups/20261003T101500-ab12/0-.mcp.json');
    expect(backupPath('x', 7, '/h/.claude/skills/demo/SKILL.md')).toBe('backups/x/7-SKILL.md');
  });
});

describe('newInstallId', () => {
  it('is a compact UTC timestamp plus 4 hex chars, unique per call', () => {
    const now = new Date('2026-10-03T10:15:00.123Z');
    const id = newInstallId(now);
    expect(id).toMatch(/^20261003T101500Z-[0-9a-f]{4}$/);
    const ids = new Set(Array.from({ length: 20 }, () => newInstallId(now)));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('init-mcps re-export', () => {
  it('exposes the same StaleFileError class', () => {
    expect(initMcps.StaleFileError).toBe(StaleFileError);
  });
});

describe('restore and rollback', () => {
  let tmp: TmpPaths;
  const fs = new NodeFileSystem();
  beforeEach(async () => {
    tmp = await makeTmpPaths();
  });
  afterEach(() => tmp.cleanup());

  it('restoreText writes the previous text, or removes the file when it did not exist', async () => {
    const path = join(tmp.cwd, 'a.json');
    await restoreText(fs, path, 'old');
    expect(await readFile(path, 'utf8')).toBe('old');
    await restoreText(fs, path, null);
    expect(await fs.exists(path)).toBe(false);
  });

  it('restoreBytes writes the previous bytes, or removes the file when it did not exist', async () => {
    const path = join(tmp.cwd, 'b.bin');
    await restoreBytes(fs, path, new Uint8Array([1, 2, 3]));
    expect([...(await readFile(path))]).toEqual([1, 2, 3]);
    await restoreBytes(fs, path, null);
    expect(await fs.exists(path)).toBe(false);
  });

  it('rollback reverts newest first, removes dirs and returns the original cause', async () => {
    const path = join(tmp.cwd, 'c.txt');
    await writeFile(path, 'v0');
    const order: string[] = [];
    const undo = [
      () => Promise.resolve(void order.push('first')),
      async () => {
        order.push('second');
        await restoreText(fs, path, 'v0');
      },
    ];
    await writeFile(path, 'v1');
    const cause = new Error('boom');
    expect(await rollback(fs, undo, [], cause)).toBe(cause);
    expect(order).toEqual(['second', 'first']);
    expect(await readFile(path, 'utf8')).toBe('v0');
  });

  it('rollback attempts every step and annotates the error when one fails', async () => {
    let ran = false;
    const undo = [
      () => {
        ran = true;
        return Promise.resolve();
      },
      () => Promise.reject(new Error('disk gone')),
    ];
    const result = await rollback(fs, undo, [], new Error('boom'));
    expect(ran).toBe(true);
    expect((result as Error).message).toBe('boom; rollback incomplete: disk gone');
  });
});
