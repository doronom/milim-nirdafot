import { normalizeWord } from '../../content/text';
import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { pairKey } from '../practice';
import { isPair, type GameEnv, type LevelItem, type PracticeItem } from '../types';
import { CROSS_MAX, generateCrossword, type Crossword } from './generate';

export interface CrosswordRound {
  puzzle: Crossword;
  /** The practice item behind each placed word, by item key. */
  items: Record<string, PracticeItem>;
  /** Letter tiles offered for each word: its letters plus a few decoys, shuffled. */
  tiles: Record<string, string[]>;
}

const DECOYS = 'יוהלאמרתבשנדכעחקפסגטזצ';

/** Single words of 2-7 letters fit a mini crossword. */
const fitsGrid = (word: string) =>
  !/[\s־]/.test(normalizeWord(word)) && normalizeWord(word).length >= 2 && normalizeWord(word).length <= CROSS_MAX;

/** The synonym an item contributes: its own if it fits, otherwise another synonym of the entry that does. */
function crossItem(item: PracticeItem): PracticeItem | null {
  if (fitsGrid(item.synonym)) return item;
  const other = item.entry.synonyms.find(fitsGrid);
  return other ? { ...item, key: pairKey(item.entry, other), synonym: other } : null;
}

export const crosswordPlayable = (items: readonly LevelItem[]): PracticeItem[] =>
  items.filter(isPair).filter((i) => crossItem(i) !== null);

export const clueFor = (item: PracticeItem): string =>
  `מילה נרדפת ל־${item.entry.headword}${item.entry.hint ? ` (${item.entry.hint})` : ''}`;

/** A mini crossword from up to 8 of the items; clues read "מילה נרדפת ל־X". Items that do not cross are left out. */
export function buildCrosswordRound(
  _env: GameEnv,
  items: LevelItem[],
  _difficulty: Difficulty,
  rng: Rng,
): CrosswordRound {
  const usable = rng
    .shuffle(items.filter(isPair))
    .map(crossItem)
    .filter((i): i is PracticeItem => i !== null)
    .slice(0, 8);
  const puzzle = generateCrossword(
    usable.map((i) => ({ answer: normalizeWord(i.synonym), clue: clueFor(i), itemKey: i.key })),
    rng,
  );
  const byKey = new Map(usable.map((i) => [i.key, i]));
  const tiles = Object.fromEntries(
    puzzle.words.map((w) => {
      const decoys = rng.shuffle([...DECOYS].filter((ch) => !w.answer.includes(ch))).slice(0, 3);
      return [w.itemKey, rng.shuffle([...w.answer, ...decoys])];
    }),
  );
  return { puzzle, items: Object.fromEntries(puzzle.words.map((w) => [w.itemKey, byKey.get(w.itemKey)!])), tiles };
}
