import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TmpPaths {
  root: string;
  homeDir: string;
  cwd: string;
  cleanup: () => Promise<void>;
}

/** Creates an isolated temp root with injected `homeDir` and `cwd` directories. */
export async function makeTmpPaths(): Promise<TmpPaths> {
  const root = await mkdtemp(join(tmpdir(), 'shitaku-test-'));
  const { mkdir } = await import('node:fs/promises');
  const homeDir = join(root, 'home');
  const cwd = join(root, 'cwd');
  await mkdir(homeDir);
  await mkdir(cwd);
  return { root, homeDir, cwd, cleanup: () => rm(root, { recursive: true, force: true }) };
}
