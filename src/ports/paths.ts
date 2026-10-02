/** All filesystem locations derive from these two injected roots; nothing reads the real home. */
export interface Paths {
  homeDir: string;
  cwd: string;
}
