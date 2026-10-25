import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initialProgress, type Progress } from '../engine/progress';
import type { KeyValueStore } from '../storage/kv';
import { ProgressContext } from './progress-context';

const KEY = 'progress';

/** Loads progress from the store once, keeps it in memory, and writes every change back. */
export function ProgressProvider({
  store,
  initial,
  children,
}: {
  store: KeyValueStore;
  initial?: Progress;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState<Progress>(initial ?? initialProgress());
  const [loaded, setLoaded] = useState(initial !== undefined);

  useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    store
      .get<Progress>(KEY)
      .then((saved) => {
        if (!cancelled && saved) setProgress(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [store, initial]);

  const update = useCallback(
    (change: (p: Progress) => Progress) => {
      setProgress((prev) => {
        const next = change(prev);
        void store.set(KEY, next);
        return next;
      });
    },
    [store],
  );

  const value = useMemo(() => ({ progress, loaded, update }), [progress, loaded, update]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}
