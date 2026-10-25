import type { Difficulty } from '../../engine/adaptive';
import { pickDistractors } from '../../engine/distractors';
import type { Rng } from '../../engine/rng';
import type { GameEnv, PracticeItem } from '../types';

export interface Bubble {
  word: string;
  nodeId: string;
  intruder: boolean;
}

export interface OddQuestion {
  item: PracticeItem;
  /** Three words of one entry (pairwise direct synonyms) and one intruder, shuffled. */
  bubbles: Bubble[];
}

export interface OddRound {
  questions: OddQuestion[];
}

/** An entry can host a question when it has at least three words: the headword and two synonyms. */
export const canHostOdd = (item: PracticeItem): boolean => item.entry.synonyms.length >= 2;

/**
 * Four floating bubbles: the item's pair plus one more word from the same entry, and an intruder drawn like a pick
 * distractor (never from the entry's synonym group). Items whose entry has fewer than three words are skipped.
 */
export function buildOddRound(env: GameEnv, items: PracticeItem[], difficulty: Difficulty, rng: Rng): OddRound {
  return {
    questions: items.filter(canHostOdd).map((item) => {
      const others = item.entry.synonyms.filter((s) => s !== item.synonym);
      const third = rng.pick(others);
      const words = [item.entry.headword, item.synonym, third];
      const [intruder] = pickDistractors(env.graph, {
        target: item.entry,
        answer: item.synonym,
        tier: difficulty.tier,
        count: 1,
        rng,
        pool: env.pool,
        decisions: env.decisions,
      });
      const bubbles: Bubble[] = [
        ...words.map((w) => ({ word: w, nodeId: env.graph.resolve(item.entry.id, w), intruder: false })),
        { word: intruder!.word, nodeId: intruder!.nodeId, intruder: true },
      ];
      return { item, bubbles: rng.shuffle(bubbles) };
    }),
  };
}

/** The popped word is the intruder when it is directly linked to none of the other bubbles. */
export const isIntruder = (env: GameEnv, question: OddQuestion, word: string): boolean =>
  question.bubbles.filter((b) => b.word !== word).every((b) => !env.links.areLinked(b.word, word));
