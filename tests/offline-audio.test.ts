import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIO_CACHE, clipUrls, syncClips, type ClipCache, type OfflineAudioStatus } from '../src/audio/offline-audio';
import manifest from '../src/generated/audio-manifest.json';

const BASE = 'https://game.example/milim/';

function fakeCache(initial: string[] = []) {
  const urls = new Set(initial);
  const cache: ClipCache = {
    keys: async () => [...urls].map((url) => ({ url })),
    put: async (url) => void urls.add(url),
    delete: async (url) => urls.delete(url),
  };
  return { cache, urls };
}

/** A network that answers after a tick, counts how many requests run at once, and fails the URLs in `down`. */
function fakeNetwork(down = new Set<string>()) {
  const net = { inFlight: 0, peak: 0, requests: [] as string[] };
  const fetcher = async (url: string) => {
    net.requests.push(url);
    net.inFlight++;
    net.peak = Math.max(net.peak, net.inFlight);
    await new Promise((r) => setTimeout(r, 1));
    net.inFlight--;
    if (down.has(url)) throw new TypeError('Failed to fetch');
    return new Response('mp3');
  };
  return { net, fetcher };
}

const urls = (n: number) => Array.from({ length: n }, (_, i) => `${BASE}audio/${i}.mp3`);

describe('offline audio', () => {
  it('lists every clip in the manifest once, as absolute URLs under the base', () => {
    const list = clipUrls(BASE);
    expect(list.length).toBe(new Set(Object.values(manifest.clips)).size);
    expect(new Set(list).size).toBe(list.length);
    expect(list.every((u) => /^https:\/\/game\.example\/milim\/audio\/[0-9a-f]{16}\.mp3$/.test(u))).toBe(true);
  });

  it('downloads every missing clip, a bounded number at a time, and reports progress', async () => {
    const { cache, urls: cached } = fakeCache();
    const { net, fetcher } = fakeNetwork();
    const seen: OfflineAudioStatus[] = [];
    const status = await syncClips(cache, urls(40), fetcher, (s) => seen.push(s), { concurrency: 6 });
    expect(status).toEqual({ done: 40, total: 40, state: 'complete' });
    expect(cached.size).toBe(40);
    expect(net.peak).toBe(6);
    expect(seen[0]).toEqual({ done: 0, total: 40, state: 'downloading' });
    expect(seen.filter((s) => s.state === 'downloading').map((s) => s.done)).toEqual([...Array(41).keys()]);
  });

  it('resumes where it stopped and deletes clips nothing uses any more', async () => {
    const all = urls(10);
    const { cache, urls: cached } = fakeCache([...all.slice(0, 7), `${BASE}audio/old.mp3`]);
    const { net, fetcher } = fakeNetwork();
    const status = await syncClips(cache, all, fetcher, () => undefined);
    expect(status.state).toBe('complete');
    expect(net.requests.sort()).toEqual(all.slice(7).sort());
    expect([...cached].sort()).toEqual([...all].sort());
  });

  it('does nothing when every clip is already saved', async () => {
    const all = urls(5);
    const { cache } = fakeCache(all);
    const { net, fetcher } = fakeNetwork();
    expect(await syncClips(cache, all, fetcher, () => undefined)).toEqual({ done: 5, total: 5, state: 'complete' });
    expect(net.requests).toEqual([]);
  });

  it('pauses when the network drops, keeping what it saved, and finishes on the next run', async () => {
    const all = urls(20);
    const { cache, urls: cached } = fakeCache();
    const offline = fakeNetwork(new Set(all.slice(10)));
    const first = await syncClips(cache, all, offline.fetcher, () => undefined, { concurrency: 1, retryDelayMs: 0 });
    expect(first).toEqual({ done: 10, total: 20, state: 'paused' });
    expect(cached.size).toBe(10);
    // The failing clip was tried three times before giving up.
    expect(offline.net.requests.filter((u) => u === all[10])).toHaveLength(3);

    const online = fakeNetwork();
    expect(await syncClips(cache, all, online.fetcher, () => undefined)).toEqual({
      done: 20,
      total: 20,
      state: 'complete',
    });
    expect(online.net.requests).toHaveLength(10);
  });

  it('only reports complete once the cache shows every clip, deleting a stuck entry before writing it again', async () => {
    const all = urls(6);
    const { cache, urls: cached } = fakeCache();
    // As in Safari after a write was cut off: writing these clips "succeeds" but stores nothing until they are deleted.
    const stuck = new Set([all[1], all[4]]);
    const { put, delete: remove } = cache;
    cache.put = async (url, response) => {
      if (!stuck.has(url)) await put(url, response);
    };
    cache.delete = async (url) => stuck.delete(url) || remove(url);
    const { net, fetcher } = fakeNetwork();
    expect(await syncClips(cache, all, fetcher, () => undefined)).toEqual({ done: 6, total: 6, state: 'complete' });
    expect(cached.size).toBe(6);
    expect(net.requests).toHaveLength(8);
  });

  it('never saves an error response', async () => {
    const all = urls(2);
    const { cache, urls: cached } = fakeCache();
    const status = await syncClips(
      cache,
      all,
      async () => new Response('gone', { status: 404 }),
      () => undefined,
    );
    expect(status.state).toBe('paused');
    expect(cached.size).toBe(0);
  });

  it('shares its cache with the service worker route, and the precache leaves audio out', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    expect(config).toContain(`cacheName: '${AUDIO_CACHE}'`);
    expect(config).not.toMatch(/globPatterns:[^\n]*mp3/);
  });
});
