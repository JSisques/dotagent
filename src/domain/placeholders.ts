// Secret placeholder rules. Only `${VAR}` / `${VAR:-default}` references are ever written.
export interface Placeholder {
  name: string;
  hasDefault: boolean;
}

const PLACEHOLDER = /\$\{([A-Z_][A-Z0-9_]*)(:-[^}]*)?\}/g;

export function extractPlaceholders(value: string): Placeholder[] {
  return [...value.matchAll(PLACEHOLDER)].map((m) => ({ name: m[1] as string, hasDefault: m[2] !== undefined }));
}

export function hasPlaceholder(value: string): boolean {
  return extractPlaceholders(value).length > 0;
}
