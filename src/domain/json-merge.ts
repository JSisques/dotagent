// Pure JSON merge: replaces only named entries under a key path and keeps every other key intact.
export class ConfigError extends Error {}

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseRoot(text: string | null): JsonObject {
  if (text === null) return {};
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new ConfigError(`config is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isObject(doc)) throw new ConfigError('config root must be a JSON object');
  return doc;
}

/** Indent unit of the original (tab, or the first indentation width); defaults to 2. */
export function detectIndent(text: string): number | string {
  const m = /^[ \t]+(?=\S)/m.exec(text);
  if (!m) return 2;
  return m[0].startsWith('\t') ? '\t' : m[0].length;
}

/** Returns the object at `keyPath`, or `{}` when the file or the path is absent. */
export function readAtPath(text: string | null, keyPath: string[]): JsonObject {
  let node: unknown = parseRoot(text);
  for (const key of keyPath) {
    node = (node as JsonObject)[key];
    if (node === undefined) return {};
    if (!isObject(node)) throw new ConfigError(`'${keyPath.join('.')}' must be a JSON object`);
  }
  return node as JsonObject;
}

/** Deletes `names` under `keyPath`. Names or paths that are absent are ignored; every other key keeps value and order. */
export function removeAtPath(text: string, keyPath: string[], names: string[]): string {
  const root = parseRoot(text);
  let node: JsonObject = root;
  for (const key of keyPath) {
    const next = node[key];
    if (next === undefined) return text;
    if (!isObject(next)) throw new ConfigError(`'${keyPath.join('.')}' must be a JSON object`);
    node = next;
  }
  for (const name of names) delete node[name];
  const trailing = text.endsWith('\n') ? '\n' : '';
  return JSON.stringify(root, null, detectIndent(text)) + trailing;
}

/** Sets `entries` under `keyPath`. New names are appended; all other keys keep their value and order. */
export function mergeAtPath(text: string | null, keyPath: string[], entries: JsonObject): string {
  const root = parseRoot(text);
  let node = root;
  for (const key of keyPath) {
    const next = node[key];
    if (next === undefined) node[key] = {};
    else if (!isObject(next)) throw new ConfigError(`'${keyPath.join('.')}' must be a JSON object`);
    node = node[key] as JsonObject;
  }
  Object.assign(node, entries);
  const trailing = text === null || text.endsWith('\n') ? '\n' : '';
  return JSON.stringify(root, null, text === null ? 2 : detectIndent(text)) + trailing;
}
