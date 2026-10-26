import type { Difficulty } from '../../engine/adaptive';
import { pickDistractors } from '../../engine/distractors';
import type { Rng } from '../../engine/rng';
import type { GameEnv, PracticeItem } from '../types';

export interface PickOption {
  word: string;
  nodeId: string;
  correct: boolean;
}

export interface PickQuestion {
  item: PracticeItem;
  prompt: string;
  hint: string | null;
  options: PickOption[];
}

export interface PickRound {
  questions: PickQuestion[];
}

/** One question per item: the headword and `difficulty.options` choices, exactly one directly linked to it. */
export function buildPickRound(env: GameEnv, items: PracticeItem[], difficulty: Difficulty, rng: Rng): PickRound {
  return {
    questions: items.map((item) => {
      const distractors = pickDistractors(env.graph, {
        target: item.entry,
        answer: item.synonym,
        tier: difficulty.tier,
        count: difficulty.options - 1,
        rng,
        pool: env.pool,
        decisions: env.decisions,
      });
      const answer: PickOption = {
        word: item.synonym,
        nodeId: env.graph.resolve(item.entry.id, item.synonym),
        correct: true,
      };
      const options = rng.shuffle([
        answer,
        ...distractors.map((d) => ({
          word: d.word,
          nodeId: d.nodeId,
          correct: env.links.areLinked(item.entry.headword, d.word),
        })),
      ]);
      return { item, prompt: item.entry.headword, hint: item.entry.hint, options };
    }),
  };
}
