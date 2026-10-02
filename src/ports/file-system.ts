export interface FileSystem {
  /** Resolves to null when the file does not exist. */
  readText(path: string): Promise<string | null>;
  /** Writes via a temp file in the same directory and a rename; creates missing parent directories. */
  writeAtomic(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
}
