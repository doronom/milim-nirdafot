import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isPair, type GameEnv, type LevelItem, type PracticeItem } from '../types';

export interface TypeQuestion {
  item: PracticeItem;
  prompt: string;
  hint: string | null;
  /** Every word directly linked to the headword: any of them is a right answer. */
  accepted: string[];
}

export interface TypeRound {
  questions: TypeQuestion[];
}

/** One question per pair: type any synonym of the headword (direct links only, see links.ts). */
export function buildTypeRound(env: GameEnv, items: LevelItem[], _difficulty: Difficulty, rng: Rng): TypeRound {
  return {
    questions: rng.shuffle(items.filter(isPair)).map((item) => ({
      item,
      prompt: item.entry.headword,
      hint: item.entry.hint,
      accepted: [...new Set([...item.entry.synonyms, ...env.links.linksOf(item.entry.headword)])],
    })),
  };
}
