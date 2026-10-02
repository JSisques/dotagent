import type { OwnedItem } from '@/domain/manifest.js';
import type { Scope } from '@/ports/agent-target.js';

/** Widens when a new kind of managed item lands. */
export type ItemKind = OwnedItem['kind'];

export type StatusState = 'installed' | 'modified' | 'out-of-date' | 'missing' | 'missing-from-catalog' | 'unknown';

/** What is on disk now for an item. `unreadable` covers unsafe trees and config files that cannot be parsed. */
export type Observed = { kind: 'absent' } | { kind: 'unreadable' } | { kind: 'hash'; hash: string };

/** What the catalog would install now. `unavailable` means the catalog failed to load. */
export type Desired = { kind: 'unavailable' } | { kind: 'absent' } | { kind: 'hash'; hash: string };

export interface StatusItem {
  scope: Scope;
  kind: ItemKind;
  name: string;
  state: StatusState;
  path: string;
  installId: string;
}

/** Classifies one owned item from its recorded hash, what is on disk, and what the catalog offers. Order matters: local drift wins over the catalog. */
export function classifyStatus(owned: string, current: Observed, desired: Desired): StatusState {
  if (current.kind === 'absent') return 'missing';
  if (current.kind === 'unreadable' || current.hash !== owned) return 'modified';
  if (desired.kind === 'unavailable') return 'unknown';
  if (desired.kind === 'absent') return 'missing-from-catalog';
  return desired.hash === owned ? 'installed' : 'out-of-date';
}
