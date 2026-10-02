import type { Profile } from './schema.js';

/** Resolves a profile to its MCP names: parents first, de-duplicated in first-seen order. */
export function resolveProfile(name: string, profiles: readonly Profile[], mcpNames: readonly string[]): string[] {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const known = new Set(mcpNames);
  const result = new Set<string>();

  const visit = (current: string, trail: string[]): void => {
    if (trail.includes(current)) throw new Error(`profile cycle: ${[...trail, current].join(' -> ')}`);
    const profile = byName.get(current);
    if (!profile)
      throw new Error(`unknown profile '${current}'${trail.length ? ` (extended by '${trail.at(-1)}')` : ''}`);
    for (const parent of profile.extends) visit(parent, [...trail, current]);
    for (const mcp of profile.mcps) {
      if (!known.has(mcp)) throw new Error(`profile '${current}' references unknown mcp '${mcp}'`);
      result.add(mcp);
    }
  };

  visit(name, []);
  return [...result];
}

/** Returns one error message per profile that fails to resolve. */
export function validateProfiles(profiles: readonly Profile[], mcpNames: readonly string[]): string[] {
  return profiles.flatMap((p) => {
    try {
      resolveProfile(p.name, profiles, mcpNames);
      return [];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  });
}
