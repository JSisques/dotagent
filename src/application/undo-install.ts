import { sha256 } from '@/domain/hash.js';
import type { Install, InstalledFile, Manifest } from '@/domain/manifest.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { loadManifest, saveManifest, stateDir } from './journal.js';

export interface UndoDeps {
  fs: FileSystem;
  paths: Paths;
  /** Clock for `undoneAt`; defaults to the system clock. */
  now?: () => Date;
}

export interface UndoRequest {
  /** Install to undo; defaults to the newest non-undone one. */
  id?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface UndoResult {
  status: 'nothing' | 'already-undone' | 'dry-run' | 'refused' | 'undone';
  /** 3 when a file changed since the install and `force` is not set, otherwise 0. */
  exitCode: 0 | 3;
  installId?: string;
  /** Files the install touched. */
  files: string[];
  /** Files whose current content no longer matches what the install wrote. */
  changed: string[];
}

/** The requested install is unknown, or a newer install still owns one of its files. */
export class UndoSelectionError extends Error {}
/** A restore did not produce the bytes recorded before the install. */
export class UndoVerifyError extends Error {}

const result = (status: UndoResult['status'], install?: Install, changed: string[] = []): UndoResult => ({
  status,
  exitCode: status === 'refused' ? 3 : 0,
  installId: install?.id,
  files: install?.files.map((f) => f.path) ?? [],
  changed,
});

/** LIFO per file: refuse while a newer non-undone install touched one of the same files. */
function assertNewestPerFile(manifest: Manifest, install: Install): void {
  const newer = manifest.installs.slice(manifest.installs.indexOf(install) + 1).filter((i) => i.undoneAt === null);
  for (const file of install.files) {
    const blocker = newer.find((i) => i.files.some((f) => f.path === file.path));
    if (blocker) throw new UndoSelectionError(`${file.path} has a newer install (${blocker.id}); undo that one first`);
  }
}

const hashOf = (text: string | null): string | null => (text === null ? null : sha256(text));

async function restore(deps: UndoDeps, file: InstalledFile): Promise<void> {
  if (file.backup === null) {
    await deps.fs.remove(file.path);
  } else {
    const bytes = await deps.fs.readText(`${stateDir(deps.paths.homeDir)}/${file.backup}`);
    if (bytes === null) throw new UndoVerifyError(`backup for ${file.path} is missing`);
    await deps.fs.writeAtomic(file.path, bytes);
  }
  if (hashOf(await deps.fs.readText(file.path)) !== file.beforeHash)
    throw new UndoVerifyError(`${file.path} does not match its pre-install content after restore`);
}

export async function undoInstall(deps: UndoDeps, req: UndoRequest = {}): Promise<UndoResult> {
  const { homeDir } = deps.paths;
  const manifest = await loadManifest(deps.fs, homeDir);
  const install =
    req.id === undefined
      ? [...manifest.installs].reverse().find((i) => i.undoneAt === null)
      : manifest.installs.find((i) => i.id === req.id);
  if (req.id !== undefined && !install) throw new UndoSelectionError(`no install with id ${req.id}`);
  if (!install) return result('nothing');
  if (install.undoneAt !== null) return result('already-undone', install);
  assertNewestPerFile(manifest, install);

  const changed: string[] = [];
  for (const file of install.files)
    if (hashOf(await deps.fs.readText(file.path)) !== file.afterHash) changed.push(file.path);
  if (changed.length > 0 && !req.force) return result('refused', install, changed);
  if (req.dryRun) return result('dry-run', install, changed);

  for (const file of install.files) await restore(deps, file);
  const undoneAt = (deps.now ?? (() => new Date()))().toISOString();
  await saveManifest(deps.fs, homeDir, {
    ...manifest,
    installs: manifest.installs.map((i) => (i === install ? { ...i, undoneAt } : i)),
  });
  return result('undone', install, changed);
}
