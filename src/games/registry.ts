import type { GameId } from '../config/game';
import { gameInfo } from './catalog';
import { buildContextRound } from './contextChoice/build';
import { ContextChoice } from './contextChoice/ContextChoice';
import { buildDragRound } from './dragPairs/build';
import { DragPairs } from './dragPairs/DragPairs';
import { buildLadderRound } from './intensityLadder/build';
import { IntensityLadder } from './intensityLadder/IntensityLadder';
import { buildMemoryRound } from './memory/build';
import { Memory } from './memory/Memory';
import { buildOddRound } from './oddOneOut/build';
import { OddOneOut } from './oddOneOut/OddOneOut';
import { buildPickRound } from './pickSynonym/build';
import { PickSynonym } from './pickSynonym/PickSynonym';
import { buildRegisterRound } from './registerSort/build';
import { RegisterSort } from './registerSort/RegisterSort';
import { buildSwapRound } from './swapWord/build';
import { SwapWord } from './swapWord/SwapWord';
import { isPair, type GameDefinition, type GameEnv, type LevelItem } from './types';
import { buildWordSearchRound } from './wordSearch/build';
import { WordSearch } from './wordSearch/WordSearch';

export { GAME_CATALOG } from './catalog';

/** A game with its round type erased, so different games fit one map. Each round only reaches its own Component. */
export type AnyGame = GameDefinition<never>;
const defineGame = <R>(def: GameDefinition<R>): AnyGame => def as unknown as AnyGame;

/** Game definitions bound to a session's environment, so buildRound keeps the shared (items, difficulty, rng) shape. */
export function createGames(env: GameEnv): Map<GameId, AnyGame> {
  const games = [
    defineGame({
      ...gameInfo('pickSynonym'),
      minWorld: 1,
      buildRound: (i, d, r) => buildPickRound(env, filterPairs(i), d, r),
      Component: PickSynonym,
    }),
    defineGame({
      ...gameInfo('dragPairs'),
      minWorld: 1,
      buildRound: (i, d, r) => buildDragRound(env, filterPairs(i), d, r),
      Component: DragPairs,
    }),
    defineGame({
      ...gameInfo('memory'),
      minWorld: 1,
      buildRound: (i, d, r) => buildMemoryRound(env, filterPairs(i), d, r),
      Component: Memory,
    }),
    defineGame({
      ...gameInfo('wordSearch'),
      minWorld: 2,
      buildRound: (i, d, r) => buildWordSearchRound(env, filterPairs(i), d, r),
      Component: WordSearch,
    }),
    defineGame({
      ...gameInfo('oddOneOut'),
      minWorld: 2,
      buildRound: (i, d, r) => buildOddRound(env, filterPairs(i), d, r),
      Component: OddOneOut,
    }),
    defineGame({
      ...gameInfo('swapWord'),
      minWorld: 2,
      buildRound: (i, d, r) => buildSwapRound(env, filterPairs(i), d, r),
      Component: SwapWord,
    }),
    defineGame({
      ...gameInfo('intensityLadder'),
      minWorld: 3,
      buildRound: buildLadderRound,
      Component: IntensityLadder,
    }),
    defineGame({ ...gameInfo('registerSort'), minWorld: 3, buildRound: buildRegisterRound, Component: RegisterSort }),
    defineGame({ ...gameInfo('contextChoice'), minWorld: 3, buildRound: buildContextRound, Component: ContextChoice }),
  ];
  return new Map(games.map((g) => [g.id, g]));
}

/** World 1-2 games play pairs only; the planner already passes just their playable items. */
const filterPairs = (items: LevelItem[]) => items.filter(isPair);
