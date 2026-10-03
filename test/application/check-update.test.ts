import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { checkForUpdate, updateCachePath, type UpdateCheckDeps } from '@/application/check-update.js';
import type { LatestVersionSource } from '@/ports/version-source.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

const NOW = new Date('2026-01-10T12:00:00.000Z');
const HOUR = 3_600_000;
const NOTICE = 'Update available: shitaku 0.2.0 -> 0.3.0. Run: npm install -g @jsisques/shitaku';

describe('checkForUpdate', () => {
  let tmp: TmpPaths;
  let fs: NodeFileSystem;
  let calls: number;
  let signals: AbortSignal[];

  beforeEach(async () => {
    tmp = await makeTmpPaths();
    fs = new NodeFileSystem();
    calls = 0;
    signals = [];
  });
  afterEach(() => tmp.cleanup());

  const sourceReturning = (value: string | null): LatestVersionSource => ({
    latest: (signal) => (calls++, signals.push(signal), Promise.resolve(value)),
  });

  const deps = (over: Partial<UpdateCheckDeps> = {}): UpdateCheckDeps => ({
    fs,
    paths: { homeDir: tmp.homeDir, cwd: tmp.cwd },
    env: {},
    source: sourceReturning('0.3.0'),
    now: () => NOW,
    ...over,
  });
  const request = { currentVersion: '0.2.0', interactive: true };
  const cachePath = (): string => updateCachePath(tmp.homeDir);
  const seed = (ageMs: number, latest: string | null): Promise<void> =>
    fs.writeAtomic(cachePath(), JSON.stringify({ checkedAt: new Date(NOW.getTime() - ageMs).toISOString(), latest }));
  const cached = async (): Promise<unknown> => JSON.parse((await fs.readText(cachePath())) ?? 'null');

  it.each([
    ['opt-out 1', { SHITAKU_NO_UPDATE_CHECK: '1' }, true],
    ['opt-out TRUE', { SHITAKU_NO_UPDATE_CHECK: 'TRUE' }, true],
    ['CI', { CI: 'true' }, true],
    ['non-TTY', {}, false],
  ])('skips entirely on %s: no read, fetch or write', async (_name, env, interactive) => {
    await seed(HOUR, '9.9.9');
    const before = await fs.readText(cachePath());
    const reads: string[] = [];
    const spyFs = Object.create(fs) as NodeFileSystem;
    spyFs.readText = (path) => (reads.push(path), fs.readText(path));

    const result = await checkForUpdate(deps({ env, fs: spyFs }), { ...request, interactive });

    expect(result).toBeNull();
    expect(reads).toEqual([]);
    expect(calls).toBe(0);
    expect(await fs.readText(cachePath())).toBe(before);
  });

  it.each(['', '0', 'false', 'no'])('does not skip for falsy opt-out %j or an empty CI', async (value) => {
    const result = await checkForUpdate(deps({ env: { SHITAKU_NO_UPDATE_CHECK: value, CI: '' } }), request);
    expect(result).toBe(NOTICE);
  });

  it('uses a fresh cache as is, without fetching', async () => {
    await seed(HOUR, '0.3.0');
    expect(await checkForUpdate(deps(), request)).toBe(NOTICE);
    expect(calls).toBe(0);
  });

  it('prints nothing when the fresh cache is not newer', async () => {
    await seed(HOUR, '0.2.0');
    expect(await checkForUpdate(deps(), request)).toBeNull();
    expect(calls).toBe(0);
  });

  it('fetches, writes the cache and returns the fresh notice when absent', async () => {
    expect(await checkForUpdate(deps(), request)).toBe(NOTICE);
    expect(calls).toBe(1);
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: '0.3.0' });
  });

  it('refreshes a stale cache', async () => {
    await seed(25 * HOUR, '0.2.5');
    expect(await checkForUpdate(deps(), request)).toBe(NOTICE);
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: '0.3.0' });
  });

  it('treats a corrupt cache as absent and rewrites it', async () => {
    await fs.writeAtomic(cachePath(), '{nope');
    expect(await checkForUpdate(deps(), request)).toBe(NOTICE);
    expect(calls).toBe(1);
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: '0.3.0' });
  });

  it('prints nothing for the same or an older latest version', async () => {
    expect(await checkForUpdate(deps({ source: sourceReturning('0.2.0') }), request)).toBeNull();
    expect(
      await checkForUpdate(deps({ source: sourceReturning('0.1.0') }), { ...request, currentVersion: '0.2.0' }),
    ).toBeNull();
  });

  it('offline: keeps the previous latest, refreshes checkedAt and still shows the known notice', async () => {
    await seed(25 * HOUR, '0.3.0');
    expect(await checkForUpdate(deps({ source: sourceReturning(null) }), request)).toBe(NOTICE);
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: '0.3.0' });
  });

  it('offline with no previous cache writes a null latest and prints nothing', async () => {
    expect(await checkForUpdate(deps({ source: sourceReturning(null) }), request)).toBeNull();
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: null });
  });

  it('does not retry within the TTL after a failed refresh', async () => {
    await checkForUpdate(deps({ source: sourceReturning(null) }), request);
    await checkForUpdate(deps({ source: sourceReturning(null) }), request);
    expect(calls).toBe(1);
  });

  it('never rejects when the source throws', async () => {
    const source: LatestVersionSource = { latest: () => Promise.reject(new Error('boom')) };
    expect(await checkForUpdate(deps({ source }), request)).toBeNull();
  });

  it('never rejects when the file system throws', async () => {
    const broken = Object.create(fs) as NodeFileSystem;
    broken.readText = () => Promise.reject(new Error('EIO'));
    expect(await checkForUpdate(deps({ fs: broken }), request)).toBeNull();
  });

  it('still returns the fetched notice when the cache cannot be written', async () => {
    const readonly = Object.create(fs) as NodeFileSystem;
    readonly.writeAtomic = () => Promise.reject(new Error('EACCES'));
    expect(await checkForUpdate(deps({ fs: readonly }), request)).toBe(NOTICE);
  });

  it('honors timeoutMs even when the source ignores the abort signal', async () => {
    const source: LatestVersionSource = { latest: () => new Promise(() => undefined) };
    const started = Date.now();
    const result = await checkForUpdate(deps({ source }), { ...request, timeoutMs: 30 });
    expect(result).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await cached()).toEqual({ checkedAt: NOW.toISOString(), latest: null });
  });

  it('passes an abort signal that fires after timeoutMs', async () => {
    const source: LatestVersionSource = {
      latest: (signal) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(null))),
    };
    expect(await checkForUpdate(deps({ source }), { ...request, timeoutMs: 30 })).toBeNull();
  });
});
