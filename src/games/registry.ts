import type { GameId } from '../config/game';
import { GAME_CATALOG } from './catalog';
import { buildDragRound } from './dragPairs/build';
import { DragPairs } from './dragPairs/DragPairs';
import { buildMemoryRound } from './memory/build';
import { Memory } from './memory/Memory';
import { buildOddRound } from './oddOneOut/build';
import { OddOneOut } from './oddOneOut/OddOneOut';
import { buildPickRound } from './pickSynonym/build';
import { PickSynonym } from './pickSynonym/PickSynonym';
import { buildSwapRound } from './swapWord/build';
import { SwapWord } from './swapWord/SwapWord';
import type { GameDefinition, GameEnv } from './types';
import { buildWordSearchRound } from './wordSearch/build';
import { WordSearch } from './wordSearch/WordSearch';

/** A game with its round type erased, so different games fit one map. Each round only reaches its own Component. */
export type AnyGame = GameDefinition<never>;
const defineGame = <R>(def: GameDefinition<R>): AnyGame => def as unknown as AnyGame;

const info = (id: GameId) => GAME_CATALOG.find((g) => g.id === id)!;

/** Game definitions bound to a session's environment, so buildRound keeps the shared (items, difficulty, rng) shape. */
export function createGames(env: GameEnv): Map<GameId, AnyGame> {
  const games = [
    defineGame({
      ...info('pickSynonym'),
      minWorld: 1,
      buildRound: (i, d, r) => buildPickRound(env, i, d, r),
      Component: PickSynonym,
    }),
    defineGame({
      ...info('dragPairs'),
      minWorld: 1,
      buildRound: (i, d, r) => buildDragRound(env, i, d, r),
      Component: DragPairs,
    }),
    defineGame({
      ...info('memory'),
      minWorld: 1,
      buildRound: (i, d, r) => buildMemoryRound(env, i, d, r),
      Component: Memory,
    }),
    defineGame({
      ...info('wordSearch'),
      minWorld: 2,
      buildRound: (i, d, r) => buildWordSearchRound(env, i, d, r),
      Component: WordSearch,
    }),
    defineGame({
      ...info('oddOneOut'),
      minWorld: 2,
      buildRound: (i, d, r) => buildOddRound(env, i, d, r),
      Component: OddOneOut,
    }),
    defineGame({
      ...info('swapWord'),
      minWorld: 2,
      buildRound: (i, d, r) => buildSwapRound(env, i, d, r),
      Component: SwapWord,
    }),
  ];
  return new Map(games.map((g) => [g.id, g]));
}

export { GAME_CATALOG, REVIEW_GAME } from './catalog';
