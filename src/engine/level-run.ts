import type { GameId, WorldId } from '../config/game';
import { gamesForWorld } from '../config/game';
import type { Answer, GameInfo, LevelItem, PlanContext, RoundResult, Stage } from '../games/types';
import { adapt, type Difficulty } from './adaptive';
import type { Outcome } from './attempt';
import { sessionOutcome } from './leitner';
import type { Stars } from './progress';
import type { Rng } from './rng';

export type { GameInfo };

export interface RoundPlan {
  gameId: GameId;
  stage: Stage;
  items: LevelItem[];
  difficulty: Difficulty;
}

export const STAGES: readonly Stage[] = ['recognition', 'discrimination', 'production'];
export const MAX_ROUNDS = 4;

/** Which items a game can play in this level, and which game reviews missed items. */
export interface Planner {
  playable(gameId: GameId, items: readonly LevelItem[]): LevelItem[];
  /** A recognition round for missed items, or null when no unlocked game can play them. */
  reviewRound(items: readonly LevelItem[]): { gameId: GameId; stage: Stage; items: LevelItem[] } | null;
}

export function createPlanner(world: WorldId, catalog: readonly GameInfo[], ctx: PlanContext): Planner {
  const unlocked = catalog.filter((g) => gamesForWorld(world).includes(g.id));
  const playable = (gameId: GameId, items: readonly LevelItem[]) => {
    const game = unlocked.find((g) => g.id === gameId);
    return game ? [...game.playable(items, ctx)] : [];
  };
  return {
    playable,
    reviewRound: (items) => {
      // The catalog lists the plain recognition game for each item kind first.
      let best: { gameId: GameId; stage: Stage; items: LevelItem[] } | null = null;
      for (const g of unlocked) {
        const covered = [...g.playable(items, ctx)];
        if (covered.length >= Math.max(1, g.minItems) && covered.length > (best?.items.length ?? 0)) {
          best = { gameId: g.id, stage: g.stages[0]!, items: covered };
        }
      }
      return best;
    },
  };
}

/**
 * Rounds for a level, in recognition -> discrimination -> production order. Each stage gets the unlocked game that can
 * play the most of the items (random among ties, for variety). Items no planned round can play (e.g. pair guests in a
 * scales level) get one extra round, when a game can play them.
 */
export function planRounds(
  world: WorldId,
  catalog: readonly GameInfo[],
  items: readonly LevelItem[],
  rng: Rng,
  ctx: PlanContext,
): Omit<RoundPlan, 'difficulty'>[] {
  const unlocked = catalog.filter((g) => gamesForWorld(world).includes(g.id));
  const rounds: Omit<RoundPlan, 'difficulty'>[] = [];
  for (const stage of STAGES) {
    const options = unlocked
      .filter((g) => g.stages.includes(stage))
      .map((g) => ({ g, covered: [...g.playable(items, ctx)] }))
      .filter(({ g, covered }) => covered.length >= g.minItems);
    if (options.length === 0) continue;
    const most = Math.max(...options.map((o) => o.covered.length));
    const { g, covered } = rng.pick(options.filter((o) => o.covered.length === most));
    rounds.push({ gameId: g.id, stage, items: covered });
  }
  const inRounds = new Set(rounds.flatMap((r) => r.items.map((i) => i.key)));
  const left = items.filter((i) => !inRounds.has(i.key));
  if (left.length > 0 && rounds.length < MAX_ROUNDS) {
    const review = createPlanner(world, catalog, ctx).reviewRound(left);
    if (review) rounds.push(review);
  }
  return rounds;
}

export interface LevelRun {
  /** Boss and placement runs ask each item once: no re-inserted items or extra rounds. */
  singlePass: boolean;
  rounds: RoundPlan[];
  /** Index of the round being played; equals rounds.length when the level is finished. */
  index: number;
  difficulty: Difficulty;
  answers: Answer[];
  /** Items already re-inserted once after a weak round. */
  reinserted: string[];
}

export function startRun(
  rounds: Omit<RoundPlan, 'difficulty'>[],
  difficulty: Difficulty,
  singlePass = false,
): LevelRun {
  return {
    singlePass,
    rounds: rounds.map((r) => ({ ...r, difficulty })),
    index: 0,
    difficulty,
    answers: [],
    reinserted: [],
  };
}

/**
 * A single pass for boss levels: each item asked once, grouped by kind into recognition rounds with the plain game
 * for that kind (pick for pairs, the World 3-4 game for the rest), so 15 items mean 15 questions.
 */
export function planSinglePass(
  world: WorldId,
  catalog: readonly GameInfo[],
  items: readonly LevelItem[],
  ctx: PlanContext,
): Omit<RoundPlan, 'difficulty'>[] {
  const planner = createPlanner(world, catalog, ctx);
  const rounds: Omit<RoundPlan, 'difficulty'>[] = [];
  let left = [...items];
  while (left.length > 0) {
    const round = planner.reviewRound(left);
    if (!round) break;
    rounds.push(round);
    const covered = new Set(round.items.map((i) => i.key));
    left = left.filter((i) => !covered.has(i.key));
  }
  return rounds;
}

export function roundAccuracy(answers: readonly Answer[]): number {
  if (answers.length === 0) return 1;
  // "Also correct" is not a mistake.
  return answers.filter((a) => a.outcome !== 'wrong').length / answers.length;
}

/**
 * Records a finished round and adapts the next one: 90%+ raises difficulty, below 60% lowers it and re-inserts each
 * missed item once, into the next round if its game can play it, otherwise into an extra review round (up to 4).
 */
export function finishRound(run: LevelRun, result: RoundResult, planner: Planner): LevelRun {
  const { next, reinsertMissed } = adapt(run.difficulty, roundAccuracy(result.answers));
  const rounds = run.rounds.map((r, i) => (i > run.index ? { ...r, difficulty: next } : r));
  let reinserted = run.reinserted;
  if (reinsertMissed && !run.singlePass) {
    const playing = rounds[run.index]!;
    const missedKeys = new Set(result.answers.filter((a) => a.outcome === 'wrong').map((a) => a.itemKey));
    let missed = playing.items.filter((i) => missedKeys.has(i.key) && !reinserted.includes(i.key));
    if (missed.length > 0) {
      reinserted = [...reinserted, ...missed.map((i) => i.key)];
      const target = rounds[run.index + 1];
      if (target) {
        const fits = planner.playable(target.gameId, missed);
        const have = new Set(target.items.map((i) => i.key));
        rounds[run.index + 1] = { ...target, items: [...target.items, ...fits.filter((i) => !have.has(i.key))] };
        const placed = new Set(fits.map((i) => i.key));
        missed = missed.filter((i) => !placed.has(i.key) && !have.has(i.key));
      }
      if (missed.length > 0 && rounds.length < MAX_ROUNDS) {
        const review = planner.reviewRound(missed);
        if (review) rounds.push({ ...review, difficulty: next });
      }
    }
  }
  return {
    ...run,
    rounds,
    index: run.index + 1,
    difficulty: next,
    answers: [...run.answers, ...result.answers],
    reinserted,
  };
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
