import { normalizeWord } from '../../content/text';
import type { Idiom } from '../../content/types';
import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isIdiom, type GameEnv, type IdiomItem, type LevelItem, type Stage } from '../types';

export type IdiomMode = 'meaning' | 'idiom' | 'fill';

export interface FillIn {
  before: string;
  after: string;
  answer: string;
  options: string[];
}

export interface IdiomQuestion {
  item: IdiomItem;
  /** What is shown: the idiom (meaning mode), its meaning (idiom mode), or nothing extra (fill mode). */
  prompt: string;
  options: string[];
  answer: string;
  /** The example sentence with the idiom blanked out: the bonus step after a match, or the question in fill mode. */
  fill: FillIn;
}

export interface IdiomRound {
  mode: IdiomMode;
  questions: IdiomQuestion[];
}

const tokens = (s: string) =>
  normalizeWord(s)
    .split(/[\s,]+/)
    .filter((t) => t.length >= 3);

/**
 * Two idioms are too close to sit side by side when their meanings share a word, a three-letter stretch inside words
 * of four letters or more (עקשן / התעקש), or a direct synonym link (הצליח / עשה חיל share "הצליח").
 */
export function idiomsConflict(env: Pick<GameEnv, 'links'>, a: Idiom, b: Idiom): boolean {
  const ta = tokens(a.meaning);
  const tb = tokens(b.meaning);
  for (const x of ta) {
    for (const y of tb) {
      if (x === y || env.links.areLinked(x, y)) return true;
      if (x.length >= 4 && y.length >= 4) {
        for (let i = 0; i + 3 <= x.length; i++) if (y.includes(x.slice(i, i + 3))) return true;
      }
    }
  }
  return false;
}

function blank(idiom: Idiom): { before: string; after: string } {
  const at = idiom.example.indexOf(idiom.exampleAnswer);
  return { before: idiom.example.slice(0, at), after: idiom.example.slice(at + idiom.exampleAnswer.length) };
}

/**
 * recognition: idiom -> meaning, then a bonus fill-in of the example sentence.
 * discrimination: meaning -> idiom.
 * production: fill the idiom into its example sentence.
 * Wrong options are other idioms whose meanings do not overlap the answer's.
 */
export function buildIdiomRound(
  env: GameEnv,
  items: LevelItem[],
  difficulty: Difficulty,
  rng: Rng,
  stage: Stage,
): IdiomRound {
  const mode: IdiomMode = stage === 'recognition' ? 'meaning' : stage === 'discrimination' ? 'idiom' : 'fill';
  const all = env.content.idioms;
  return {
    mode,
    questions: items.filter(isIdiom).map((item) => {
      const others = rng.shuffle(all.filter((i) => i.id !== item.idiom.id && !idiomsConflict(env, item.idiom, i)));
      const wrong = others.slice(0, difficulty.options - 1);
      const pick = (f: (i: Idiom) => string) => rng.shuffle([f(item.idiom), ...wrong.map(f)]);
      const fill: FillIn = {
        ...blank(item.idiom),
        answer: item.idiom.exampleAnswer,
        options: rng.shuffle([item.idiom.exampleAnswer, ...others.slice(0, 2).map((i) => i.exampleAnswer)]),
      };
      if (mode === 'meaning')
        return { item, prompt: item.idiom.idiom, options: pick((i) => i.meaning), answer: item.idiom.meaning, fill };
      if (mode === 'idiom')
        return { item, prompt: item.idiom.meaning, options: pick((i) => i.idiom), answer: item.idiom.idiom, fill };
      return { item, prompt: '', options: fill.options, answer: fill.answer, fill };
    }),
  };
}
