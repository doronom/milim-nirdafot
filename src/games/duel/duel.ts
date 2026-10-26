import type { WorldId } from '../../config/game';
import { createRng } from '../../engine/rng';
import { splitBlank } from '../contextChoice/build';
import { buildIdiomRound } from '../idiomMatch/build';
import { buildPickRound } from '../pickSynonym/build';
import { practiceItemFor } from '../practice';
import type { GameEnv, LevelItem } from '../types';

export const DUEL_LENGTHS = [5, 10, 15] as const;
export type DuelLength = (typeof DUEL_LENGTHS)[number];

/** One question both players answer, with the same options in the same order. */
export interface DuelQuestion {
  id: string;
  prompt: string;
  /** For context questions: the sentence around the blank. */
  sentence?: { before: string; after: string };
  options: string[];
  answer: string;
  /** "[word] = [answer]" for the results screen. */
  formula: string;
}

/**
 * Questions from the chosen worlds, mixed in a seeded order: synonym picks from World 1 (everyday booklet words) and
 * World 2 (the rest), context choices from World 3, idiom meanings from World 4.
 */
export function buildDuel(env: GameEnv, worlds: readonly WorldId[], length: DuelLength, seed: string): DuelQuestion[] {
  const rng = createRng(`${seed}:duel`);
  const entries = env.content.entries.filter(
    (e) =>
      e.source !== 'custom' &&
      ((worlds.includes(1) && e.source === 'booklet' && e.difficulty === 1) ||
        (worlds.includes(2) && (e.source === 'extra' || e.difficulty > 1))),
  );
  const per = Math.ceil(length / Math.max(1, worlds.length));
  const questions: DuelQuestion[] = [];
  if (entries.length > 0) {
    const want = (worlds.includes(1) ? per : 0) + (worlds.includes(2) ? per : 0);
    const items = rng
      .shuffle(entries)
      .slice(0, want)
      .map((e) => practiceItemFor(e, {}));
    for (const q of buildPickRound(env, items, { tier: 2, options: 4 }, rng).questions) {
      const answer = q.options.find((o) => o.correct)!.word;
      questions.push({
        id: q.item.key,
        prompt: q.prompt,
        options: q.options.map((o) => o.word),
        answer,
        formula: `${q.prompt} = ${answer}`,
      });
    }
  }
  if (worlds.includes(3)) {
    for (const c of rng.shuffle(env.content.contexts).slice(0, per)) {
      questions.push({
        id: c.id,
        prompt: 'איזו מילה מתאימה?',
        sentence: splitBlank(c.sentence),
        options: rng.shuffle(c.options),
        answer: c.answer,
        formula: c.sentence.replace('___', c.answer),
      });
    }
  }
  if (worlds.includes(4)) {
    const items: LevelItem[] = rng
      .shuffle(env.content.idioms)
      .slice(0, per)
      .map((i) => ({ kind: 'idiom', key: i.id, idiom: i }));
    for (const q of buildIdiomRound(env, items, { tier: 2, options: 4 }, rng, 'recognition').questions) {
      questions.push({
        id: q.item.key,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        formula: `${q.prompt} = ${q.answer}`,
      });
    }
  }
  return rng.shuffle(questions).slice(0, length);
}

export interface DuelAnswer {
  questionId: string;
  choice: string;
  correct: boolean;
  ms: number;
}

export interface DuelStats {
  correct: number;
  total: number;
  avgMs: number;
  bestStreak: number;
}

export function duelStats(answers: readonly DuelAnswer[]): DuelStats {
  let streak = 0;
  let bestStreak = 0;
  for (const a of answers) {
    streak = a.correct ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const correct = answers.filter((a) => a.correct).length;
  const avgMs = answers.length ? Math.round(answers.reduce((s, a) => s + a.ms, 0) / answers.length) : 0;
  return { correct, total: answers.length, avgMs, bestStreak };
}

/** More right answers wins; on a tie, the faster average answer; exactly equal is a draw. */
export function duelWinner(a: DuelStats, b: DuelStats): 0 | 1 | 'tie' {
  if (a.correct !== b.correct) return a.correct > b.correct ? 0 : 1;
  if (a.avgMs !== b.avgMs) return a.avgMs < b.avgMs ? 0 : 1;
  return 'tie';
}

/** "The words that decided it": questions exactly one player got right. */
export function decisiveQuestions(
  questions: readonly DuelQuestion[],
  a: readonly DuelAnswer[],
  b: readonly DuelAnswer[],
): DuelQuestion[] {
  const right = (list: readonly DuelAnswer[], id: string) => list.find((x) => x.questionId === id)?.correct ?? false;
  return questions.filter((q) => right(a, q.id) !== right(b, q.id));
}
