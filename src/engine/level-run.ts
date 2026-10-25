import type { GameId, WorldId } from '../config/game';
import { gamesForWorld } from '../config/game';
import type { Answer, PracticeItem, RoundResult, Stage } from '../games/types';
import { adapt, type Difficulty } from './adaptive';
import { sessionOutcome } from './leitner';
import type { Outcome } from './attempt';
import type { Rng } from './rng';
import type { Stars } from './progress';

export interface GameInfo {
  id: GameId;
  stage: Stage;
  minItems: number;
}

export interface RoundPlan {
  gameId: GameId;
  items: PracticeItem[];
  difficulty: Difficulty;
}

export const STAGES: readonly Stage[] = ['recognition', 'discrimination', 'production'];
export const MAX_ROUNDS = 4;

/** One game per stage, from the games the world has unlocked, in recognition -> discrimination -> production order. */
export function planStages(world: WorldId, catalog: readonly GameInfo[], itemCount: number, rng: Rng): GameId[] {
  const unlocked = new Set(gamesForWorld(world));
  return STAGES.flatMap((stage) => {
    const options = catalog.filter((g) => g.stage === stage && unlocked.has(g.id) && g.minItems <= itemCount);
    return options.length > 0 ? [rng.pick(options).id] : [];
  });
}

export interface LevelRun {
  rounds: RoundPlan[];
  /** Index of the round being played; equals rounds.length when the level is finished. */
  index: number;
  difficulty: Difficulty;
  answers: Answer[];
  /** Items already re-inserted once after a weak round. */
  reinserted: string[];
}

export function startRun(stages: GameId[], items: PracticeItem[], difficulty: Difficulty): LevelRun {
  return {
    rounds: stages.map((gameId) => ({ gameId, items, difficulty })),
    index: 0,
    difficulty,
    answers: [],
    reinserted: [],
  };
}

export function roundAccuracy(answers: readonly Answer[]): number {
  if (answers.length === 0) return 1;
  // "Also correct" is not a mistake.
  return answers.filter((a) => a.outcome !== 'wrong').length / answers.length;
}

/**
 * Records a finished round and adapts the next one: 90%+ raises difficulty, below 60% lowers it and re-inserts each
 * missed item once, into the next round or, after the last stage, into an extra recognition round.
 */
export function finishRound(run: LevelRun, result: RoundResult, reviewGame: GameId): LevelRun {
  const { next, reinsertMissed } = adapt(run.difficulty, roundAccuracy(result.answers));
  const rounds = run.rounds.map((r, i) => (i > run.index ? { ...r, difficulty: next } : r));
  let reinserted = run.reinserted;
  if (reinsertMissed) {
    const playing = rounds[run.index]!;
    const missedKeys = new Set(result.answers.filter((a) => a.outcome === 'wrong').map((a) => a.itemKey));
    const missed = playing.items.filter((i) => missedKeys.has(i.key) && !reinserted.includes(i.key));
    if (missed.length > 0) {
      reinserted = [...reinserted, ...missed.map((i) => i.key)];
      const target = rounds[run.index + 1];
      if (target) {
        const have = new Set(target.items.map((i) => i.key));
        rounds[run.index + 1] = { ...target, items: [...target.items, ...missed.filter((i) => !have.has(i.key))] };
      } else if (rounds.length < MAX_ROUNDS) {
        rounds.push({ gameId: reviewGame, items: missed, difficulty: next });
      }
    }
  }
  return { rounds, index: run.index + 1, difficulty: next, answers: [...run.answers, ...result.answers], reinserted };
}

export const isRunDone = (run: LevelRun): boolean => run.index >= run.rounds.length;

export interface LevelOutcome {
  accuracy: number;
  stars: Stars;
  /** One folded outcome per item key, for the Leitner update. */
  perItem: Record<string, Outcome>;
  /** Items with at least one wrong answer, for "words to practise". */
  missed: string[];
  correctAnswers: number;
}

/** 90%+ earns 3 stars, 75%+ earns 2, and finishing always earns 1. */
export const starsFor = (accuracy: number): Stars => (accuracy >= 0.9 ? 3 : accuracy >= 0.75 ? 2 : 1);

export function levelOutcome(run: LevelRun): LevelOutcome {
  const byItem = new Map<string, Outcome[]>();
  for (const a of run.answers) byItem.set(a.itemKey, [...(byItem.get(a.itemKey) ?? []), a.outcome]);
  const perItem = Object.fromEntries([...byItem].map(([k, outcomes]) => [k, sessionOutcome(outcomes)]));
  const accuracy = roundAccuracy(run.answers);
  return {
    accuracy,
    stars: starsFor(accuracy),
    perItem,
    missed: Object.entries(perItem)
      .filter(([, o]) => o === 'wrong')
      .map(([k]) => k),
    correctAnswers: run.answers.filter((a) => a.outcome !== 'wrong').length,
  };
}
