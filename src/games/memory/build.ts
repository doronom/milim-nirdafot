import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { conflictFreeGroups } from '../practice';
import type { GameEnv, PracticeItem } from '../types';

export interface MemoryCard {
  id: string;
  word: string;
  item: PracticeItem;
}

export interface MemoryRound {
  cards: MemoryCard[];
  /** Items whose pairs are on the board. */
  items: PracticeItem[];
}

/** 8 pairs once the child is doing well (tier 2+) and there are enough items, otherwise 6 (or fewer when short). */
export const memoryPairs = (difficulty: Difficulty, available: number): number =>
  Math.min(available, difficulty.tier >= 2 && available >= 8 ? 8 : 6);

export function buildMemoryRound(env: GameEnv, items: PracticeItem[], difficulty: Difficulty, rng: Rng): MemoryRound {
  // Take the largest conflict-free set, so no two unrelated cards are synonyms of each other.
  const [board = []] = conflictFreeGroups(
    rng.shuffle(items),
    memoryPairs(difficulty, items.length),
    env.links.areLinked,
  );
  const cards = board.flatMap((item) => [
    { id: `${item.key}:h`, word: item.entry.headword, item },
    { id: `${item.key}:s`, word: item.synonym, item },
  ]);
  return { cards: rng.shuffle(cards), items: board };
}

export const cardsMatch = (env: GameEnv, a: MemoryCard, b: MemoryCard): boolean =>
  a.id !== b.id && env.links.areLinked(a.word, b.word);
