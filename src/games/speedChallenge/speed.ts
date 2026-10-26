import type { Entry } from '../../content/types';
import { createRng } from '../../engine/rng';
import { buildPickRound, type PickQuestion } from '../pickSynonym/build';
import { practiceItemFor } from '../practice';
import type { GameEnv } from '../types';

export const SPEED_SECONDS = 60;
export const COMBO_MAX = 5;
export const POINTS_PER_CORRECT = 10;

/**
 * The questions for one run: mixed pick-the-synonym questions over the given entries, in a seeded order. More than a
 * child can answer in a minute, so the run never runs dry.
 */
export function buildSpeedQuestions(env: GameEnv, entries: readonly Entry[], seed: string, count = 80): PickQuestion[] {
  const rng = createRng(`${seed}:speed`);
  const items = rng
    .shuffle(entries)
    .slice(0, count)
    .map((e) => practiceItemFor(e, {}));
  return buildPickRound(env, items, { tier: 2, options: 3 }, rng).questions;
}

/** The combo multiplier after `streak` correct answers in a row: 1x, then up one per two in a row, up to 5x. */
export const comboFor = (streak: number): number => Math.min(COMBO_MAX, 1 + Math.floor(streak / 2));

export interface SpeedTally {
  score: number;
  correct: number;
  answered: number;
  streak: number;
}

export const emptyTally: SpeedTally = { score: 0, correct: 0, answered: 0, streak: 0 };

/** Adds one answer: a right answer scores 10 x the combo and extends the streak; a wrong one resets the streak only. */
export function tallyAnswer(t: SpeedTally, correct: boolean): SpeedTally {
  if (!correct) return { ...t, answered: t.answered + 1, streak: 0 };
  const streak = t.streak + 1;
  return {
    score: t.score + POINTS_PER_CORRECT * comboFor(streak - 1),
    correct: t.correct + 1,
    answered: t.answered + 1,
    streak,
  };
}
