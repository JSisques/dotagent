import { z } from 'zod';
import type { LatestVersionSource } from '@/ports/version-source.js';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const LatestDoc = z.object({ version: z.string() });

/** Reads the `latest` dist-tag of a package from the npm registry. Resolves null on any failure. */
export class NpmRegistryVersionSource implements LatestVersionSource {
  constructor(
    private readonly packageName: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly registry: string = DEFAULT_REGISTRY,
  ) {}

  async latest(signal: AbortSignal): Promise<string | null> {
    try {
      // Scoped names keep the `@` but encode the slash: `@scope%2Fname`.
      const url = `${this.registry}/${this.packageName.replace('/', '%2F')}/latest`;
      const res = await this.fetchFn(url, { signal });
      if (!res.ok) return null;
      const parsed = LatestDoc.safeParse(await res.json());
      return parsed.success ? parsed.data.version : null;
    } catch {
      return null;
    }
  }
}
