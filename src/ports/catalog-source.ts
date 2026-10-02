import type { Catalog } from '../domain/catalog/schema.js';

export interface SourceRef {
  kind: 'bundled' | 'folder';
  location: string;
}

/** A file that failed validation. Valid items stay usable; this one is not installable. */
export interface CatalogIssue {
  file: string;
  reason: string;
}

export interface LoadedCatalog extends Catalog {
  issues: CatalogIssue[];
}

export interface CatalogSource {
  ref(): SourceRef;
  /** Rejects when the source folder or its catalog.json is missing or unreadable. */
  load(): Promise<LoadedCatalog>;
}
