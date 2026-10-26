import type { KeyValueStore } from '../storage/kv';
import { say } from './player';

/** The parent's recording of a custom word, stored as a Blob in IndexedDB under this prefix plus the entry id. */
export const RECORDING_PREFIX = 'recording:';
/** Longest recording, in seconds. */
export const MAX_RECORDING_SECONDS = 5;

export const getRecording = (store: KeyValueStore, entryId: string): Promise<Blob | undefined> =>
  store.get<Blob>(RECORDING_PREFIX + entryId).catch(() => undefined);

export const saveRecording = (store: KeyValueStore, entryId: string, blob: Blob): Promise<void> =>
  store.set(RECORDING_PREFIX + entryId, blob);

export const deleteRecording = (store: KeyValueStore, entryId: string): Promise<void> =>
  store.del(RECORDING_PREFIX + entryId);

/** Plays a Blob once; returns a stop function. Silent on any playback error. */
export function playBlob(blob: Blob): () => void {
  try {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const done = () => URL.revokeObjectURL(url);
    audio.addEventListener('ended', done, { once: true });
    void audio.play().catch(done);
    return () => {
      audio.pause();
      done();
    };
  } catch {
    return () => undefined;
  }
}

/** A word aloud: the parent's recording when there is one (it wins over clips and speech). */
export function playWord(text: string, recording?: Blob): void {
  void say(recording ? { recording } : text);
}
