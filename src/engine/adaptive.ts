import type { Tier } from './distractors';

export type OptionCount = 3 | 4 | 5;

export interface Difficulty {
  tier: Tier;
  /** Options shown in pick-style questions; other games scale their size from it. */
  options: OptionCount;
}

export const RAISE_AT = 0.9;
export const LOWER_BELOW = 0.6;

export interface Adaptation {
  next: Difficulty;
  /** Below the lower threshold, missed items come back once in the next round. */
  reinsertMissed: boolean;
}

const clampTier = (n: number) => Math.max(1, Math.min(3, n)) as Tier;
const clampOptions = (n: number) => Math.max(3, Math.min(5, n)) as OptionCount;

/** After each round: 90%+ raises tier and option count, below 60% lowers both and re-inserts the misses. */
export function adapt(current: Difficulty, accuracy: number): Adaptation {
  if (accuracy >= RAISE_AT) {
    return {
      next: { tier: clampTier(current.tier + 1), options: clampOptions(current.options + 1) },
      reinsertMissed: false,
    };
  }
  if (accuracy < LOWER_BELOW) {
    return {
      next: { tier: clampTier(current.tier - 1), options: clampOptions(current.options - 1) },
      reinsertMissed: true,
    };
  }
  return { next: current, reinsertMissed: false };
}
