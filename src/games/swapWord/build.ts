import { normalizeWord, stripNiqqud } from '../../content/text';
import type { Sentence } from '../../content/types';
import { isSwapEligible } from '../../content/model';
import type { Difficulty } from '../../engine/adaptive';
import { pickDistractors } from '../../engine/distractors';
import type { Rng } from '../../engine/rng';
import type { GameEnv, PracticeItem } from '../types';

export interface SwapOption {
  word: string;
  nodeId: string;
}

export interface SwapQuestion {
  item: PracticeItem;
  sentence: Sentence;
  /** Text before the swapped word, a one-letter prefix kept fixed (מ, ב, ה...), the headword, and the rest. */
  before: string;
  prefix: string;
  headword: string;
  after: string;
  options: SwapOption[];
}

export interface SwapRound {
  questions: SwapQuestion[];
}

const HEB = 'א-ת';

/** Splits a sentence around its headword, keeping a prefix like מ in "מפחד" outside the slot. */
export function splitAtHeadword(
  text: string,
  headword: string,
): Pick<SwapQuestion, 'before' | 'prefix' | 'headword' | 'after'> | null {
  const plain = stripNiqqud(text);
  const word = normalizeWord(headword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^${HEB}])([ובכלמשה]{0,3})(${word})(?=$|[^${HEB}])`).exec(plain);
  if (!match) return null;
  const start = match.index + match[1]!.length;
  const prefix = match[2]!;
  return {
    before: plain.slice(0, start),
    prefix,
    headword: match[3]!,
    after: plain.slice(start + prefix.length + match[3]!.length),
  };
}

/** Sentences swapWord may use for an item: reviewed only, with at least one fitting synonym. */
export const swapSentences = (env: Pick<GameEnv, 'content'>, item: PracticeItem): Sentence[] =>
  env.content.sentences.filter((s) => s.entryId === item.entry.id && s.reviewed && isSwapEligible(s));

/**
 * One question per item that has a reviewed sentence: the sentence with the headword as a slot, and a word bank of
 * one fitting synonym plus distractors. Correct means the word is in the sentence's `fits` list.
 */
export function buildSwapRound(env: GameEnv, items: PracticeItem[], difficulty: Difficulty, rng: Rng): SwapRound {
  const questions: SwapQuestion[] = [];
  for (const item of items) {
    const sentences = swapSentences(env, item);
    if (sentences.length === 0) continue;
    const sentence = rng.pick(sentences);
    const parts = splitAtHeadword(sentence.text, item.entry.headword);
    if (!parts) continue;
    const answer = sentence.fits.includes(item.synonym) ? item.synonym : rng.pick(sentence.fits);
    const distractors = pickDistractors(env.graph, {
      target: item.entry,
      answer,
      tier: difficulty.tier,
      count: difficulty.options - 1,
      rng,
      pool: env.pool,
      decisions: env.decisions,
    });
    const options = rng.shuffle([
      { word: answer, nodeId: env.graph.resolve(item.entry.id, answer) },
      ...distractors.map((d) => ({ word: d.word, nodeId: d.nodeId })),
    ]);
    questions.push({ item, sentence, ...parts, options });
  }
  return { questions };
}

/** Correctness is the sentence's own list: a synonym that does not fit this sentence is not accepted. */
export const fitsSentence = (question: SwapQuestion, word: string): boolean =>
  question.sentence.fits.some((f) => normalizeWord(f) === normalizeWord(word));
