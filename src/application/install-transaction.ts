import { randomBytes } from 'node:crypto';
import { basename } from 'node:path';
import type { FileSystem } from '@/ports/file-system.js';

/** The target changed between planning and applying in a way that alters the plan. */
export class StaleFileError extends Error {}

/** Compact UTC timestamp plus 4 random hex chars, e.g. `20261003T101500Z-ab12`. */
export const newInstallId = (now: Date): string =>
  `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}-${randomBytes(2).toString('hex')}`;

/** Backup location relative to the shitaku state directory. */
export const backupPath = (id: string, n: number, path: string): string => `backups/${id}/${n}-${basename(path)}`;

/** Puts a text file back as it was; deletes it when it did not exist. */
export const restoreText = (fs: FileSystem, path: string, before: string | null): Promise<void> =>
  before === null ? fs.remove(path) : fs.writeAtomic(path, before);

export const restoreBytes = (fs: FileSystem, path: string, before: Uint8Array | null): Promise<void> =>
  before === null ? fs.remove(path) : fs.writeBytes(path, before);

/**
 * Reverts the completed writes newest first, then removes the directories the install created, deepest first.
 * Every step is attempted; the original error is returned, annotated when some step could not be reverted.
 * Backups stay on disk.
 */
export async function rollback(
  fs: FileSystem,
  undo: (() => Promise<void>)[],
  dirs: string[],
  cause: unknown,
): Promise<unknown> {
  const failures: string[] = [];
  const attempt = async (run: () => Promise<unknown>): Promise<void> => {
    try {
      await run();
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e));
    }
  };
  for (const step of undo.reverse()) await attempt(step);
  for (const dir of dirs) await attempt(() => fs.removeDir(dir));
  if (failures.length === 0) return cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${message}; rollback incomplete: ${failures.join('; ')}`, { cause });
}
