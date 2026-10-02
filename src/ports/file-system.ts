/** Thrown when a tree holds a symlink, a special file, an unsafe path, or exceeds the size limits. */
export class UnsafeTreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeTreeError';
  }
}

export interface FileSystem {
  /** Resolves to null when the file does not exist. */
  readText(path: string): Promise<string | null>;
  /** Writes via a temp file in the same directory and a rename; creates missing parent directories. */
  writeAtomic(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  /** Resolves to null when the file does not exist. */
  readBytes(path: string): Promise<Uint8Array | null>;
  /**
   * Sorted POSIX paths, relative to `dir`, of the regular files below it. Resolves to null when `dir` does not exist.
   * Rejects with UnsafeTreeError on a symlink, a special file, or a tree beyond the catalog limits.
   */
  listFiles(dir: string): Promise<string[] | null>;
}
