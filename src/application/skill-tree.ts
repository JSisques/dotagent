import type { SkillFile } from '@/domain/catalog/skill.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';

/** Reads the files at a skill directory; null when it does not exist. Throws UnsafeTreeError on a symlink or a file that vanishes mid-read. */
export async function readPresent(fs: FileSystem, root: string): Promise<SkillFile[] | null> {
  const paths = await fs.listFiles(root);
  if (paths === null) return null;
  const files: SkillFile[] = [];
  for (const path of paths) {
    const bytes = await fs.readBytes(`${root}/${path}`);
    if (bytes === null) throw new UnsafeTreeError(`file vanished while reading: ${root}/${path}`);
    files.push({ path, bytes });
  }
  return files;
}
