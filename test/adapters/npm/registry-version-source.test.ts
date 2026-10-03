import { describe, expect, it } from 'vitest';
import { NpmRegistryVersionSource } from '@/adapters/npm/registry-version-source.js';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const source = (fetchFn: typeof fetch) => new NpmRegistryVersionSource('@jsisques/shitaku', fetchFn);

describe('NpmRegistryVersionSource', () => {
  it('requests the encoded latest URL with the signal and returns the version', async () => {
    const seen: { url: string; signal?: AbortSignal | null }[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      seen.push({ url, signal: init?.signal });
      return Promise.resolve(json({ name: '@jsisques/shitaku', version: '0.3.0' }));
    }) as typeof fetch;
    const signal = new AbortController().signal;
    expect(await source(fetchFn).latest(signal)).toBe('0.3.0');
    expect(seen).toEqual([{ url: 'https://registry.npmjs.org/@jsisques%2Fshitaku/latest', signal }]);
  });

  it.each([
    ['non-ok status', () => Promise.resolve(json({ version: '9.9.9' }, 404))],
    ['invalid JSON', () => Promise.resolve(new Response('<html>', { status: 200 }))],
    ['schema miss', () => Promise.resolve(json({ version: 3 }))],
    ['missing version', () => Promise.resolve(json({}))],
    ['rejected fetch', () => Promise.reject(new Error('offline'))],
  ])('resolves null on %s', async (_name, respond) => {
    expect(await source(() => respond()).latest(new AbortController().signal)).toBeNull();
  });

  it('resolves null when the signal aborts the request', async () => {
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    expect(await source(fetchFn).latest(AbortSignal.timeout(10))).toBeNull();
  });
});
