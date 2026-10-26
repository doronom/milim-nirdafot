/** Debounced uploads: many quick changes become one upload; `flush` uploads now (level end, app backgrounded). */
export interface UploadScheduler {
  schedule(): void;
  flush(): Promise<void>;
  dispose(): void;
}

export const UPLOAD_DEBOUNCE_MS = 20_000;

export function createUploadScheduler(upload: () => Promise<void>, delayMs = UPLOAD_DEBOUNCE_MS): UploadScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let dirty = false;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  // One upload at a time; a change during an upload triggers one more afterwards.
  const run = async (): Promise<void> => {
    clear();
    if (running) {
      dirty = true;
      return running;
    }
    dirty = false;
    running = upload()
      .catch(() => undefined)
      .finally(() => {
        running = null;
      });
    await running;
    if (dirty) await run();
  };

  return {
    schedule: () => {
      clear();
      timer = setTimeout(() => void run(), delayMs);
    },
    flush: run,
    dispose: clear,
  };
}
