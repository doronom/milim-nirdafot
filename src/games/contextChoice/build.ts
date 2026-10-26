import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { isContext, type ContextItem, type LevelItem, type Stage } from '../types';

export interface ContextQuestion {
  item: ContextItem;
  before: string;
  after: string;
  /** The options, shuffled. In "sentence" mode each is shown filled into the sentence. */
  options: string[];
}

/**
 * choose: fill the blank with the word that fits (recognition and production).
 * sentence: the sentence appears once per option; pick the one that is right (discrimination).
 */
export interface ContextRound {
  mode: 'choose' | 'sentence';
  questions: ContextQuestion[];
}

export function splitBlank(sentence: string): { before: string; after: string } {
  const at = sentence.indexOf('___');
  return { before: sentence.slice(0, at), after: sentence.slice(at + 3) };
}

export function buildContextRound(items: LevelItem[], _difficulty: Difficulty, rng: Rng, stage: Stage): ContextRound {
  return {
    mode: stage === 'discrimination' ? 'sentence' : 'choose',
    questions: rng.shuffle(items.filter(isContext)).map((item) => ({
      item,
      ...splitBlank(item.context.sentence),
      options: rng.shuffle(item.context.options),
    })),
  };
}

export const fitsContext = (item: ContextItem, word: string): boolean => item.context.answer === word;
export const filled = (q: ContextQuestion, word: string): string => `${q.before}${word}${q.after}`;
