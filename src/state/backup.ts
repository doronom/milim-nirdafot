import { RECORDING_PREFIX } from '../audio/recordings';
import type { ContentOverrides } from '../content/overrides';
import type { Progress } from '../engine/progress';
import type { KeyValueStore } from '../storage/kv';
import { OVERRIDES_KEY } from './content-store';

export const BACKUP_FORMAT = 'word-quest-backup';
export const PROGRESS_KEY = 'progress';

/** Everything on the device besides the bundled content, under its store key. */
const DATA_KEYS = [
  PROGRESS_KEY,
  OVERRIDES_KEY,
  'review:also-correct',
  'review:item-disputes',
  'review:sentence-reports',
] as const;

/** One plain JSON file (not encrypted): progress, the parent's content changes, review queues and recordings. */
export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  data: Partial<Record<(typeof DATA_KEYS)[number], unknown>>;
  /** Custom-word recordings, base64 with their media type, by entry id. */
  recordings: Record<string, { type: string; base64: string }>;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(base64: string, type: string): Blob {
  const s = atob(base64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function createBackup(store: KeyValueStore, now = new Date()): Promise<BackupFile> {
  const data: BackupFile['data'] = {};
  for (const key of DATA_KEYS) {
    const value = await store.get(key);
    if (value !== undefined) data[key] = value;
  }
  const recordings: BackupFile['recordings'] = {};
  const custom = (data[OVERRIDES_KEY] as ContentOverrides | undefined)?.custom ?? [];
  for (const e of custom) {
    const blob = await store.get<Blob>(RECORDING_PREFIX + e.id);
    if (blob) recordings[e.id] = { type: blob.type, base64: await toBase64(blob) };
  }
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), data, recordings };
}

/** Checks a file is a backup this app wrote, with a reason in Hebrew when it is not. */
export function parseBackup(json: unknown): BackupFile {
  const f = json as Partial<BackupFile> | null;
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) throw new Error('הקובץ אינו קובץ גיבוי של מסע המילים');
  if (f.version !== 1) throw new Error('גרסת הגיבוי לא נתמכת');
  const progress = f.data?.[PROGRESS_KEY] as Progress | undefined;
  if (!progress || typeof progress !== 'object' || !progress.levels || !progress.settings)
    throw new Error('בקובץ הגיבוי חסרים נתוני התקדמות');
  return { ...f, data: f.data ?? {}, recordings: f.recordings ?? {} } as BackupFile;
}

/** Replaces everything on the device with the backup (keys missing from it are cleared). */
export async function restoreBackup(store: KeyValueStore, backup: BackupFile): Promise<void> {
  const old = (await store.get<ContentOverrides>(OVERRIDES_KEY))?.custom ?? [];
  for (const e of old) await store.del(RECORDING_PREFIX + e.id);
  for (const key of DATA_KEYS) {
    const value = backup.data[key];
    if (value === undefined) await store.del(key);
    else await store.set(key, value);
  }
  for (const [id, r] of Object.entries(backup.recordings))
    await store.set(RECORDING_PREFIX + id, fromBase64(r.base64, r.type));
}
