import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { listItemDisputes, listReports } from '../engine/review-queue';
import { listSentenceReports } from '../engine/sentence-reports';
import { useContent } from '../state/content-context';
import { listLog } from '../state/parent-log';
import { useProgress } from '../state/progress-context';
import type { KeyValueStore } from '../storage/kv';
import { pairWithCode, pullFromCloud, unpairDevice, uploadSnapshot, type CloudResult } from './child';
import { getPairing, getSyncStatus } from './local';
import { createUploadScheduler, type UploadScheduler } from './scheduler';
import { buildSnapshot, firstName } from './snapshot';
import { SyncContext, type SyncState } from './sync-context';

/** Changes that mark the end of a level: a level recorded, or stars gained. */
const levelMark = (levels: Record<string, { stars: number }>) =>
  `${Object.keys(levels).length}:${Object.values(levels).reduce((s, l) => s + l.stars, 0)}`;

/**
 * Keeps a paired child device's profile up to date in the cloud: uploads are debounced while playing, immediate at the
 * end of a level and when the app goes to the background, and retried when the device comes back online. It also picks
 * up a newer passcode hash and notices when a parent unpaired the device. Unpaired devices never load Firebase.
 */
export function SyncProvider({ store, children }: { store: KeyValueStore; children: ReactNode }) {
  const { progress, loaded } = useProgress();
  const { data, overrides } = useContent();
  const [paired, setPaired] = useState<boolean | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<number>();
  // The latest values, read when an upload actually runs.
  const latest = useRef({ progress, overrides, layout: data.layout });
  useEffect(() => {
    latest.current = { progress, overrides, layout: data.layout };
  }, [progress, overrides, data.layout]);

  const upload = useCallback(async (): Promise<CloudResult> => {
    if (!(await getPairing(store))) return 'denied';
    const [log, alsoCorrect, sentenceReports, itemDisputes] = await Promise.all([
      listLog(store),
      listReports(store),
      listSentenceReports(store),
      listItemDisputes(store),
    ]);
    const { progress: p, overrides: ov, layout } = latest.current;
    const snapshot = buildSnapshot({
      progress: p,
      overrides: ov,
      log,
      queues: { alsoCorrect, sentenceReports, itemDisputes },
      layout,
    });
    const result = await uploadSnapshot(store, firstName(p.settings.childName), snapshot);
    if (result === 'ok') setLastUploadAt(Date.now());
    if (result === 'denied') setPaired(Boolean(await getPairing(store)));
    return result;
  }, [store]);

  // The upload scheduler (upload is stable, so this runs once per store).
  const scheduler = useRef<UploadScheduler | null>(null);
  useEffect(() => {
    const s = createUploadScheduler(async () => void (await upload()));
    scheduler.current = s;
    return () => s.dispose();
  }, [upload]);

  const refresh = useCallback(async () => {
    const pairing = await getPairing(store);
    setPaired(Boolean(pairing));
    setLastUploadAt((await getSyncStatus(store)).lastUploadAt);
    return pairing;
  }, [store]);

  // On start and whenever the device comes online: check the pairing and passcode, then upload.
  useEffect(() => {
    let cancelled = false;
    const online = async () => {
      if (cancelled || !(await refresh())) return;
      await pullFromCloud(store);
      if (!cancelled && (await refresh())) await scheduler.current?.flush();
    };
    void online();
    window.addEventListener('online', online);
    return () => {
      cancelled = true;
      window.removeEventListener('online', online);
    };
  }, [store, refresh]);

  // Progress or content changed: upload soon (at once when a level was just finished).
  const mark = levelMark(progress.levels);
  const lastMark = useRef(mark);
  useEffect(() => {
    if (!loaded || !paired) return;
    if (mark !== lastMark.current) {
      lastMark.current = mark;
      void scheduler.current?.flush();
    } else scheduler.current?.schedule();
  }, [progress, overrides, mark, loaded, paired]);

  // Going to the background is often the last chance to upload.
  useEffect(() => {
    if (!paired) return;
    const hidden = () => document.visibilityState === 'hidden' && void scheduler.current?.flush();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', hidden);
    };
  }, [paired]);

  const value = useMemo<SyncState>(
    () => ({
      paired,
      lastUploadAt,
      pair: async (code) => {
        const result = await pairWithCode(store, code);
        if (result === 'ok') {
          await refresh();
          await upload();
        }
        return result;
      },
      syncNow: async () => {
        const pulled = await pullFromCloud(store);
        if (!(await refresh())) return pulled;
        return upload();
      },
      unpair: async () => {
        const result = await unpairDevice(store);
        await refresh();
        return result;
      },
      deleteCloudData: async () => {
        const result = await unpairDevice(store, true);
        await refresh();
        return result;
      },
    }),
    [paired, lastUploadAt, store, refresh, upload],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
