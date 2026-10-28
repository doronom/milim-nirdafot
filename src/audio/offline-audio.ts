import manifest from '../generated/audio-manifest.json';

/**
 * The word audio is saved for offline use by the page, not by the service worker's install: 2,000+ clips fetched one
 * after another inside the install event took longer than browsers allow, so the install was cancelled and the game
 * never worked offline. Here the clips download several at a time while the game is already playable, resume where
 * they stopped, and report progress. The service worker serves them from the same cache (vite.config.ts).
 */
export const AUDIO_CACHE = 'wq-audio-v1';
const CONCURRENCY = 8;
const ATTEMPTS = 3;
const PASSES = 3;
const FETCH_TIMEOUT_MS = 20_000;

export type OfflineAudioStatus = {
  done: number;
  total: number;
  /**
   * 'idle' until the first check of the cache ends, 'paused' when the network dropped before every clip was saved.
   * While the cache is checked again (resuming), the previous state stays, so the progress notice does not flicker.
   */
  state: 'idle' | 'downloading' | 'complete' | 'paused' | 'unsupported';
};

/** The parts of the Cache API the downloader uses (a fake in the tests). */
export type ClipCache = {
  keys(): Promise<readonly { url: string }[]>;
  put(url: string, response: Response): Promise<void>;
  delete(url: string): Promise<boolean>;
};

/** Every clip URL the game can play, absolute, without duplicates. */
export function clipUrls(base: string): string[] {
  const files = new Set(Object.values((manifest as { clips: Record<string, string> }).clips));
  return [...files].sort().map((file) => new URL(`audio/${file}`, base).href);
}

/**
 * Brings the cache in line with `urls`: deletes clips nothing uses any more, then downloads the missing ones,
 * `concurrency` at a time. Resolves when it is done or gave up (the network dropped); call again to resume.
 */
export async function syncClips(
  cache: ClipCache,
  urls: readonly string[],
  fetcher: (url: string) => Promise<Response>,
  onProgress: (status: OfflineAudioStatus) => void,
  { concurrency = CONCURRENCY, retryDelayMs = 500 } = {},
): Promise<OfflineAudioStatus> {
  const total = urls.length;
  const wanted = new Set(urls);

  const fetchOne = async (url: string, again: boolean) => {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      // A dropped connection often recovers in a moment: wait a little longer before each new attempt.
      if (attempt > 1) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt - 1)));
      try {
        const response = await fetcher(url);
        if (response.ok) {
          // Safari can report a write as done without storing it when an earlier write of that clip was cut off; the
          // write only lands once that entry is deleted.
          if (again) await cache.delete(url);
          await cache.put(url, response);
          return true;
        }
      } catch {
        // Offline or a dropped connection: retry, then give up for now.
      }
    }
    return false;
  };

  // The cache is listed again after each pass: a write cut short by a reload can be listed at first and then vanish,
  // so "every clip downloaded" is only believed once the cache shows it.
  let done = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    const cached = new Set<string>();
    for (const { url } of await cache.keys()) {
      if (wanted.has(url)) cached.add(url);
      else await cache.delete(url);
    }
    const missing = urls.filter((u) => !cached.has(u));
    done = total - missing.length;
    if (missing.length === 0) break;
    onProgress({ done, total, state: 'downloading' });

    let next = 0;
    let failed = false;
    const worker = async () => {
      while (!failed && next < missing.length) {
        const url = missing[next++]!;
        if (await fetchOne(url, pass > 0)) onProgress({ done: ++done, total, state: 'downloading' });
        else failed = true;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
    if (failed) break;
  }
  const saved = (await cache.keys()).filter(({ url }) => wanted.has(url)).length;
  const status: OfflineAudioStatus = { done: saved, total, state: saved === total ? 'complete' : 'paused' };
  onProgress(status);
  return status;
}

// The app-wide downloader: one run at a time, resumed when the device comes back online.
let status: OfflineAudioStatus = { done: 0, total: 0, state: 'idle' };
const listeners = new Set<() => void>();
const publish = (next: OfflineAudioStatus) => {
  status = next;
  listeners.forEach((l) => l());
};
export const offlineAudio = {
  get: () => status,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let running = false;
let again = false;
// A run that stopped while the device still reports a network (a shaky connection) tries again later, waiting longer
// each time; coming back online, or a run that saved something, starts over from the shortest wait.
const RETRY_SECONDS = [5, 15, 30, 60];
let retries = 0;
let retryTimer: number | undefined;
function run() {
  if (status.state === 'complete') return;
  window.clearTimeout(retryTimer);
  // Coming online while a run is still giving up must not be lost: run once more when it ends.
  if (running) {
    again = true;
    return;
  }
  running = true;
  again = false;
  const before = status.done;
  void (async () => {
    const cache = await caches.open(AUDIO_CACHE);
    await syncClips(
      {
        keys: () => cache.keys(),
        put: (url, response) => cache.put(url, response),
        delete: (url) => cache.delete(url),
      },
      clipUrls(document.baseURI),
      // When the worker controls the page its audio route answers this request; either way the clip lands in this cache.
      // A request that hangs on a bad connection is abandoned, so the run can end and try again later.
      (url) => fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      publish,
    );
  })()
    .catch(() => publish({ ...status, state: 'paused' }))
    .finally(() => {
      running = false;
      if (status.state === 'complete' || !navigator.onLine) return;
      if (again) return run();
      retries = status.done > before ? 0 : retries + 1;
      const wait = RETRY_SECONDS[Math.min(retries, RETRY_SECONDS.length - 1)]!;
      retryTimer = window.setTimeout(run, wait * 1000);
    });
}

/** Starts saving the word audio for offline use (once per app start); resumes whenever the device comes online. */
export function startOfflineAudio() {
  if (typeof caches === 'undefined') {
    publish({ done: 0, total: 0, state: 'unsupported' });
    return;
  }
  run();
  window.addEventListener('online', () => {
    retries = 0;
    run();
  });
}
