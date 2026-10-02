export interface McpServerDoc {
  type?: string;
  command?: string;
  headers?: Record<string, string>;
}

/** Loose shape of the JSON config files the tests read back from disk. */
export interface ConfigDoc {
  theme?: string;
  projects?: unknown;
  mcpServers: Record<string, McpServerDoc | undefined>;
  [key: string]: unknown;
}

/** Typed `JSON.parse` for config files, so assertions avoid `any`. */
export function parseDoc(text: string): ConfigDoc {
  return JSON.parse(text) as ConfigDoc;
}
