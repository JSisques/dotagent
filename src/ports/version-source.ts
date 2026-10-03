export interface LatestVersionSource {
  /** Resolves to null on any failure; settles promptly once `signal` aborts. */
  latest(signal: AbortSignal): Promise<string | null>;
}
