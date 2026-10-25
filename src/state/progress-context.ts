import { createContext, useContext } from 'react';
import type { Progress } from '../engine/progress';

export interface ProgressContextValue {
  progress: Progress;
  loaded: boolean;
  update: (change: (p: Progress) => Progress) => void;
}

export const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress outside ProgressProvider');
  return ctx;
}
