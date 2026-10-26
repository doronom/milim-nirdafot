import type { Box, LeitnerCard, LeitnerState } from './leitner';

export const BOXES: readonly Box[] = [1, 2, 3, 4, 5];

/** Box 4 and up: answered right across at least a week of spaced reviews. */
export const isMastered = (c: LeitnerCard): boolean => c.box >= 4;
/** Missed more than once and still low in the boxes. */
export const isStruggling = (c: LeitnerCard): boolean => c.box <= 2 && c.lapses >= 2;

export const boxCounts = (leitner: LeitnerState): Record<Box, number> => {
  const counts: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of Object.values(leitner)) counts[c.box] += 1;
  return counts;
};

export function wordSummary(leitner: LeitnerState): { total: number; mastered: number; struggling: number } {
  const cards = Object.values(leitner);
  return {
    total: cards.length,
    mastered: cards.filter(isMastered).length,
    struggling: cards.filter(isStruggling).length,
  };
}

/** Struggling items, most missed first (then lowest box, then least recently seen). */
export const strugglingKeys = (leitner: LeitnerState, limit = 10): string[] =>
  Object.entries(leitner)
    .filter(([, c]) => isStruggling(c))
    .sort(([, a], [, b]) => b.lapses - a.lapses || a.box - b.box || a.lastSeen.localeCompare(b.lastSeen))
    .slice(0, limit)
    .map(([k]) => k);

/** Mastered items, highest box first. */
export const masteredKeys = (leitner: LeitnerState, limit = 10): string[] =>
  Object.entries(leitner)
    .filter(([, c]) => isMastered(c))
    .sort(([, a], [, b]) => b.box - a.box || b.seen - a.seen)
    .slice(0, limit)
    .map(([k]) => k);
