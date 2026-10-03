import { listEntries, type CatalogEntry, type ListRequest } from '@/domain/catalog/listing.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';

export interface ListDeps {
  source: CatalogSource;
}

export interface ListReport {
  items: CatalogEntry[];
  issues: CatalogIssue[];
}

/** The catalog could not be loaded. The message is the underlying cause. */
export class CatalogLoadError extends Error {}

/** Lists the catalog's items, filtered by kind and search. Never writes. */
export async function listCatalog(deps: ListDeps, req: ListRequest): Promise<ListReport> {
  let catalog: LoadedCatalog;
  try {
    catalog = await deps.source.load();
  } catch (error) {
    throw new CatalogLoadError(error instanceof Error ? error.message : String(error), { cause: error });
  }
  return { items: listEntries(catalog, req), issues: catalog.issues };
}
