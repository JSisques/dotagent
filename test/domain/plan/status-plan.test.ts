import { describe, expect, it } from 'vitest';
import { classifyStatus, type Desired, type Observed } from '@/domain/plan/status-plan.js';

const hash = (h: string): { kind: 'hash'; hash: string } => ({ kind: 'hash', hash: h });
const absent = { kind: 'absent' } as const;
const unreadable = { kind: 'unreadable' } as const;
const unavailable = { kind: 'unavailable' } as const;

describe('classifyStatus', () => {
  it('is installed when current, recorded and catalog hashes are equal', () => {
    expect(classifyStatus('h1', hash('h1'), hash('h1'))).toBe('installed');
  });

  it('is out-of-date when the item is untouched and the catalog hash differs', () => {
    expect(classifyStatus('h1', hash('h1'), hash('h2'))).toBe('out-of-date');
  });

  it('is modified when the current hash differs from the recorded one', () => {
    expect(classifyStatus('h1', hash('edited'), hash('h1'))).toBe('modified');
  });

  it('is missing when the item is absent on disk', () => {
    expect(classifyStatus('h1', absent, hash('h1'))).toBe('missing');
  });

  it('is missing-from-catalog when the item is untouched and the catalog lacks it', () => {
    expect(classifyStatus('h1', hash('h1'), absent)).toBe('missing-from-catalog');
  });

  it('is unknown when the item is untouched and the catalog is unavailable', () => {
    expect(classifyStatus('h1', hash('h1'), unavailable)).toBe('unknown');
  });

  it('lets modified win over out-of-date', () => {
    expect(classifyStatus('h1', hash('edited'), hash('h2'))).toBe('modified');
  });

  it('lets modified win over missing-from-catalog', () => {
    expect(classifyStatus('h1', hash('edited'), absent)).toBe('modified');
  });

  it('reports an unreadable item as modified', () => {
    expect(classifyStatus('h1', unreadable, hash('h1'))).toBe('modified');
  });

  it('lets missing win over every catalog outcome', () => {
    const desired: Desired[] = [hash('h1'), hash('h2'), absent, unavailable];
    expect(desired.map((d) => classifyStatus('h1', absent, d))).toEqual(['missing', 'missing', 'missing', 'missing']);
  });

  it('keeps local drift visible when the catalog is unavailable', () => {
    const cases: Observed[] = [absent, unreadable, hash('edited')];
    expect(cases.map((c) => classifyStatus('h1', c, unavailable))).toEqual(['missing', 'modified', 'modified']);
  });
});
