import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isRegister, type LevelItem, type RegisterItem, type Stage } from '../types';

export type Bin = 'everyday' | 'standard' | 'literary';
export const BINS: readonly Bin[] = ['everyday', 'standard', 'literary'];
export const BIN_LABEL: Record<Bin, string> = { everyday: 'שפת דיבור', standard: 'תקני', literary: 'ספרותי' };

export interface RegisterWord {
  word: string;
  bin: Bin;
  item: RegisterItem;
}

export interface ClassifyQuestion {
  item: RegisterItem;
  word: string;
  bin: Bin;
}

export interface SortBoard {
  items: RegisterItem[];
  /** All words of the board's sets, shuffled. */
  words: RegisterWord[];
  /** Bins no set on this board uses: shown as intentionally empty. */
  emptyBins: Bin[];
}

export type RegisterRound = { mode: 'classify'; questions: ClassifyQuestion[] } | { mode: 'sort'; boards: SortBoard[] };

export const wordsOf = (item: RegisterItem): RegisterWord[] =>
  BINS.flatMap((bin) => item.register[bin].map((word) => ({ word, bin, item })));

function board(items: RegisterItem[], rng: Rng): SortBoard {
  const words = items.flatMap(wordsOf);
  return { items, words: rng.shuffle(words), emptyBins: BINS.filter((b) => !words.some((w) => w.bin === b)) };
}

/**
 * recognition: one word of each set, "which register?".
 * discrimination: sort each set's words into the three bins.
 * production: sort two sets at once (sets that share a word stay apart).
 */
export function buildRegisterRound(items: LevelItem[], _difficulty: Difficulty, rng: Rng, stage: Stage): RegisterRound {
  const sets = rng.shuffle(items.filter(isRegister));
  if (stage === 'recognition') {
    return {
      mode: 'classify',
      questions: sets.map((item) => {
        const w = rng.pick(wordsOf(item));
        return { item, word: w.word, bin: w.bin };
      }),
    };
  }
  if (stage === 'discrimination') return { mode: 'sort', boards: sets.map((s) => board([s], rng)) };
  const boards: SortBoard[] = [];
  const left = [...sets];
  while (left.length > 0) {
    const first = left.shift()!;
    const words = new Set(wordsOf(first).map((w) => w.word));
    const partner = left.findIndex((s) => wordsOf(s).every((w) => !words.has(w.word)));
    boards.push(board(partner >= 0 ? [first, ...left.splice(partner, 1)] : [first], rng));
  }
  return { mode: 'sort', boards };
}
