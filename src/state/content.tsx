import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bundledContent, staticLayout } from '../app/data';
import { buildGameData } from '../app/game-data';
import { applyOverrides, type ContentOverrides } from '../content/overrides';
import type { KeyValueStore } from '../storage/kv';
import { ContentContext } from './content-context';
import { loadSavedContent, OVERRIDES_KEY, type SavedContent } from './content-store';

/** Loads the parent's overrides and pair decisions, and provides the game data built from them. */
export function ContentProvider({ store, children }: { store: KeyValueStore; children: ReactNode }) {
  const [saved, setSaved] = useState<SavedContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSavedContent(store).then((s) => !cancelled && setSaved(s));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const refresh = useCallback(async () => setSaved(await loadSavedContent(store)), [store]);
  const saveOverrides = useCallback(
    async (overrides: ContentOverrides) => {
      await store.set(OVERRIDES_KEY, overrides);
      setSaved((s) => (s ? { ...s, overrides } : s));
    },
    [store],
  );

  const value = useMemo(() => {
    if (!saved) return null;
    const data = buildGameData(applyOverrides(bundledContent, saved.overrides, saved.added), staticLayout);
    return { data, overrides: saved.overrides, added: saved.added, saveOverrides, refresh };
  }, [saved, saveOverrides, refresh]);
  if (!value) return null;
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
