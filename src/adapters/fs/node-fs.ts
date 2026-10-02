import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { FileSystem } from '@/ports/file-system.js';

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT';

export class NodeFileSystem implements FileSystem {
  async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  async writeAtomic(path: string, data: string): Promise<void> {
    const dir = dirname(path);
    await this.mkdirp(dir);
    const mode = await stat(path).then(
      (s) => s.mode & 0o777,
      () => 0o644,
    );
    const tmp = join(dir, `.${basename(path)}.shitaku-${randomBytes(4).toString('hex')}.tmp`);
    try {
      const handle = await open(tmp, 'w', mode);
      try {
        await handle.writeFile(data, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tmp, path);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  async mkdirp(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }
}
