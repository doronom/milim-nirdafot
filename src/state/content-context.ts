import { createContext, useContext } from 'react';
import type { GameData } from '../app/game-data';
import type { ContentOverrides, PairDecisionsAdded } from '../content/overrides';

export interface ContentContextValue {
  data: GameData;
  overrides: ContentOverrides;
  /** Pairs decided in the "also correct" queue. */
  added: PairDecisionsAdded;
  /** Saves new overrides (already checked) and rebuilds the game data. */
  saveOverrides: (next: ContentOverrides) => Promise<void>;
  /** Re-reads overrides and review decisions from the store (after deciding reports or importing a backup). */
  refresh: () => Promise<void>;
}

export const ContentContext = createContext<ContentContextValue | null>(null);

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent outside ContentProvider');
  return ctx;
}

export const useGameData = (): GameData => useContent().data;
