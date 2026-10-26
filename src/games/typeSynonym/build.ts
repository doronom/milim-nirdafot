import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { typedVocabulary } from '../../content/typing';
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
  /** All words in the content, normalized: typing one of them is never treated as a typo of the answer. */
  vocabulary: ReadonlySet<string>;
}

const vocabularyCache = new WeakMap<object, ReadonlySet<string>>();
function vocabularyOf(env: GameEnv): ReadonlySet<string> {
  let v = vocabularyCache.get(env.content);
  if (!v) {
    const c = env.content;
    v = typedVocabulary([
      ...c.entries.flatMap((e) => [e.headword, ...e.synonyms]),
      ...c.registers.flatMap((r) => [...r.everyday, ...r.standard, ...r.literary]),
      ...c.scales.flatMap((s) => s.weakToStrong),
    ]);
    vocabularyCache.set(c, v);
  }
  return v;
}

/** One question per pair: type any synonym of the headword (direct links only, see links.ts). */
export function buildTypeRound(env: GameEnv, items: LevelItem[], _difficulty: Difficulty, rng: Rng): TypeRound {
  return {
    vocabulary: vocabularyOf(env),
    questions: rng.shuffle(items.filter(isPair)).map((item) => ({
      item,
      prompt: item.entry.headword,
      hint: item.entry.hint,
      accepted: [...new Set([...item.entry.synonyms, ...env.links.linksOf(item.entry.headword)])],
    })),
  };
}
