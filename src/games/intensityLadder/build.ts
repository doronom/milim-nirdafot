import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isScale, type LevelItem, type ScaleItem, type Stage } from '../types';

export interface StrongerQuestion {
  item: ScaleItem;
  /** Two words of the scale, shuffled. */
  pair: [string, string];
  stronger: string;
}

export interface OrderQuestion {
  item: ScaleItem;
  /** The words to place, weakest first. */
  order: string[];
  /** The same words shuffled, never already in order. */
  bank: string[];
}

export type LadderRound =
  { mode: 'stronger'; questions: StrongerQuestion[] } | { mode: 'order'; questions: OrderQuestion[] };

/** A shuffle that is not the original order (when there are at least two distinct words). */
function scramble(words: string[], rng: Rng): string[] {
  for (let i = 0; i < 8; i++) {
    const s = rng.shuffle(words);
    if (s.some((w, j) => w !== words[j])) return s;
  }
  return [...words].reverse();
}

/**
 * recognition: "which is stronger?" for two words of each scale.
 * discrimination: order three words of each scale (all of a three-word scale).
 * production: order the whole scale.
 */
export function buildLadderRound(items: LevelItem[], _difficulty: Difficulty, rng: Rng, stage: Stage): LadderRound {
  const scales = items.filter(isScale);
  if (stage === 'recognition') {
    return {
      mode: 'stronger',
      questions: scales.map((item) => {
        const words = item.scale.weakToStrong;
        const [i, j] = rng
          .shuffle(words.map((_, k) => k))
          .slice(0, 2)
          .sort((a, b) => a - b) as [number, number];
        return { item, pair: rng.shuffle([words[i]!, words[j]!]) as [string, string], stronger: words[j]! };
      }),
    };
  }
  return {
    mode: 'order',
    questions: scales.map((item) => {
      const words = item.scale.weakToStrong;
      let order = words;
      if (stage === 'discrimination' && words.length > 3) {
        const keep = new Set(rng.shuffle(words.map((_, k) => k)).slice(0, 3));
        order = words.filter((_, k) => keep.has(k));
      }
      return { item, order, bank: scramble(order, rng) };
    }),
  };
}

export const isStronger = (q: StrongerQuestion, word: string): boolean => word === q.stronger;
export const isOrdered = (q: OrderQuestion, placed: readonly string[]): boolean =>
  placed.length === q.order.length && placed.every((w, i) => w === q.order[i]);
