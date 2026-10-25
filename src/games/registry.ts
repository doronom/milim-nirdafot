import type { GameId } from '../config/game';
import type { GameInfo } from '../engine/level-run';
import { buildDragRound } from './dragPairs/build';
import { DragPairs } from './dragPairs/DragPairs';
import { buildMemoryRound } from './memory/build';
import { Memory } from './memory/Memory';
import { buildPickRound } from './pickSynonym/build';
import { PickSynonym } from './pickSynonym/PickSynonym';
import type { GameDefinition, GameEnv } from './types';

/** A game with its round type erased, so different games fit one map. Each round only reaches its own Component. */
export type AnyGame = GameDefinition<never>;
const defineGame = <R>(def: GameDefinition<R>): AnyGame => def as unknown as AnyGame;

/** Game definitions bound to a session's environment, so buildRound keeps the shared (items, difficulty, rng) shape. */
export function createGames(env: GameEnv): Map<GameId, AnyGame> {
  const games = [
    defineGame({
      id: 'pickSynonym',
      minWorld: 1,
      stage: 'recognition',
      minItems: 1,
      buildRound: (items, d, rng) => buildPickRound(env, items, d, rng),
      Component: PickSynonym,
    }),
    defineGame({
      id: 'dragPairs',
      minWorld: 1,
      stage: 'discrimination',
      minItems: 2,
      buildRound: (items, d, rng) => buildDragRound(env, items, d, rng),
      Component: DragPairs,
    }),
    defineGame({
      id: 'memory',
      minWorld: 1,
      stage: 'production',
      minItems: 3,
      buildRound: (items, d, rng) => buildMemoryRound(env, items, d, rng),
      Component: Memory,
    }),
  ];
  return new Map(games.map((g) => [g.id, g]));
}

/** Stages and sizes of every game, enough to plan a level without an environment. */
export const GAME_CATALOG: readonly GameInfo[] = [
  { id: 'pickSynonym', stage: 'recognition', minItems: 1 },
  { id: 'dragPairs', stage: 'discrimination', minItems: 2 },
  { id: 'memory', stage: 'production', minItems: 3 },
];

/** The game used for extra review rounds of missed items. */
export const REVIEW_GAME: GameId = 'pickSynonym';
