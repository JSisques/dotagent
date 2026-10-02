import { emptyManifest, parseManifest, type Install, type Manifest } from '../domain/manifest.js';
import type { FileSystem } from '../ports/file-system.js';

/** Where dotagent keeps its manifest and backups; one location for both scopes. */
export const stateDir = (homeDir: string): string => `${homeDir}/.claude/.dotagent`;
export const manifestPath = (homeDir: string): string => `${stateDir(homeDir)}/manifest.json`;

/** An absent manifest means nothing was installed yet; a corrupt one throws and is never replaced. */
export async function loadManifest(fs: FileSystem, homeDir: string): Promise<Manifest> {
  const text = await fs.readText(manifestPath(homeDir));
  return text === null ? emptyManifest() : parseManifest(text);
}

export async function saveManifest(fs: FileSystem, homeDir: string, manifest: Manifest): Promise<void> {
  await fs.writeAtomic(manifestPath(homeDir), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function appendInstall(fs: FileSystem, homeDir: string, install: Install): Promise<void> {
  const manifest = await loadManifest(fs, homeDir);
  await saveManifest(fs, homeDir, { ...manifest, installs: [...manifest.installs, install] });
}
