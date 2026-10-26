import { pairKey } from '../practice';
import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isPair, type GameEnv, type LevelItem, type PracticeItem } from '../types';
import { generateWordSearch, gridLetters, type WordSearchGrid } from './generate';

export const GRID_SIZE = 10;
export const WORDS = { min: 8, max: 10 } as const;

export interface WordSearchRound {
  grid: WordSearchGrid;
  /** The practice item behind each placed word, by item key. */
  items: Record<string, PracticeItem>;
}

const fits = (word: string) => gridLetters(word).length >= 2 && gridLetters(word).length <= GRID_SIZE;

/**
 * 8-10 synonyms hidden in a 10x10 grid: each item's synonym, topped up with other synonyms of the same entries when
 * the level has fewer than 8 items. Topped-up words are practice items of their own (another pair of that entry).
 */
export function buildWordSearchRound(
  _env: GameEnv,
  items: PracticeItem[],
  _difficulty: Difficulty,
  rng: Rng,
): WordSearchRound {
  const chosen: PracticeItem[] = [];
  const seen = new Set<string>();
  const add = (item: PracticeItem) => {
    const letters = gridLetters(item.synonym);
    if (chosen.length >= WORDS.max || !fits(item.synonym) || seen.has(letters)) return;
    seen.add(letters);
    chosen.push(item);
  };
  rng.shuffle(items).forEach(add);
  for (const item of items) {
    if (chosen.length >= WORDS.min) break;
    for (const synonym of item.entry.synonyms) {
      add({ kind: 'pair', key: pairKey(item.entry, synonym), entry: item.entry, synonym, isGuest: item.isGuest });
    }
  }
  const grid = generateWordSearch(
    chosen.map((i) => ({ word: i.synonym, itemKey: i.key })),
    rng,
    GRID_SIZE,
  );
  return { grid, items: Object.fromEntries(chosen.map((i) => [i.key, i])) };
}

/** Items the word search can use: synonyms that fit the grid. */
export const wordSearchPlayable = (items: readonly LevelItem[]): PracticeItem[] =>
  items.filter(isPair).filter((i) => i.entry.synonyms.some(fits));
