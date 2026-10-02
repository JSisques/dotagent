import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderCatalogSource } from '@/adapters/catalog/folder-source.js';
import { resolveProfile } from '@/domain/catalog/profile.js';

describe('bundled catalog', () => {
  it('loads without issues and resolves profiles', async () => {
    const catalog = await new FolderCatalogSource(
      join(import.meta.dirname, '..', '..', '..', 'catalog'),
      'bundled',
    ).load();
    expect(catalog.issues).toEqual([]);
    expect(catalog.mcps.map((m) => m.name)).toEqual(['github', 'context7']);
    expect(
      resolveProfile(
        'web',
        catalog.profiles,
        catalog.mcps.map((m) => m.name),
      ),
    ).toEqual(['context7', 'github']);
  });
});
