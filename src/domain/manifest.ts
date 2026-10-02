import { z } from 'zod';

export class ManifestError extends Error {}

const ItemSchema = z.object({
  kind: z.literal('mcp'),
  name: z.string(),
  action: z.enum(['create', 'update']),
  entryHash: z.string(),
});

const FileSchema = z.object({
  path: z.string(),
  scope: z.enum(['project', 'user']),
  /** Path relative to the dotagent state directory; null when the file did not exist before the install. */
  backup: z.string().nullable(),
  beforeHash: z.string().nullable(),
  afterHash: z.string(),
  items: z.array(ItemSchema),
});

const InstallSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  undoneAt: z.string().nullable(),
  source: z.object({ kind: z.enum(['bundled', 'folder']), location: z.string(), catalogVersion: z.number() }),
  files: z.array(FileSchema),
});

export const ManifestSchema = z.object({ version: z.literal(1), installs: z.array(InstallSchema) });

export type Manifest = z.infer<typeof ManifestSchema>;
export type Install = z.infer<typeof InstallSchema>;
export type InstalledFile = z.infer<typeof FileSchema>;

export const emptyManifest = (): Manifest => ({ version: 1, installs: [] });

export function parseManifest(text: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`manifest is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ManifestError(`manifest is invalid: ${parsed.error.message}`);
  return parsed.data;
}

/** file path -> entry name -> hash of the entry dotagent last wrote. Undone installs do not count. */
export type Ownership = Record<string, Record<string, string>>;

/** Replays the non-undone installs in order, so a later install replaces an earlier hash. */
export function deriveOwnership(manifest: Manifest): Ownership {
  const owned: Ownership = {};
  for (const install of manifest.installs.filter((i) => i.undoneAt === null)) {
    for (const file of install.files) {
      const entries = (owned[file.path] ??= {});
      for (const item of file.items) entries[item.name] = item.entryHash;
    }
  }
  return owned;
}
