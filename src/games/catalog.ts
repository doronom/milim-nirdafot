import type { GameId } from '../config/game';
import { crosswordPlayable } from './crossword/build';
import { canHostOdd } from './oddOneOut/build';
import { swapSentences } from './swapWord/build';
import { isContext, isIdiom, isPair, isRegister, isScale, type GameInfo } from './types';
import { wordSearchPlayable } from './wordSearch/build';

/**
 * Stages, sizes and playable items of every game: enough to plan a level without an environment or UI.
 * World 1: pickSynonym, dragPairs, memory. World 2 adds wordSearch, oddOneOut, swapWord. World 3 adds
 * intensityLadder, registerSort, contextChoice, each serving all three stages with a mode per stage. World 4 adds
 * idiomMatch (all stages), typeSynonym and crossword (production). speedChallenge is a separate opt-in screen.
 * Within an item kind, the plain recognition game comes first: missed items are reviewed with it.
 */
export const GAME_CATALOG: readonly GameInfo[] = [
  { id: 'pickSynonym', stages: ['recognition'], minItems: 1, playable: (items) => items.filter(isPair) },
  { id: 'wordSearch', stages: ['recognition'], minItems: 4, playable: wordSearchPlayable },
  { id: 'dragPairs', stages: ['discrimination'], minItems: 2, playable: (items) => items.filter(isPair) },
  {
    id: 'oddOneOut',
    stages: ['discrimination'],
    minItems: 3,
    playable: (items) => items.filter(isPair).filter(canHostOdd),
  },
  { id: 'memory', stages: ['production'], minItems: 3, playable: (items) => items.filter(isPair) },
  {
    id: 'swapWord',
    stages: ['production'],
    minItems: 2,
    playable: (items, ctx) => items.filter(isPair).filter((i) => swapSentences(ctx, i).length > 0),
  },
  {
    id: 'intensityLadder',
    stages: ['recognition', 'discrimination', 'production'],
    minItems: 1,
    playable: (items) => items.filter(isScale),
  },
  {
    id: 'registerSort',
    stages: ['recognition', 'discrimination', 'production'],
    minItems: 1,
    playable: (items) => items.filter(isRegister),
  },
  {
    id: 'contextChoice',
    stages: ['recognition', 'discrimination', 'production'],
    minItems: 1,
    playable: (items) => items.filter(isContext),
  },
  {
    id: 'idiomMatch',
    stages: ['recognition', 'discrimination', 'production'],
    minItems: 1,
    playable: (items) => items.filter(isIdiom),
  },
  { id: 'typeSynonym', stages: ['production'], minItems: 1, playable: (items) => items.filter(isPair) },
  { id: 'crossword', stages: ['production'], minItems: 3, playable: crosswordPlayable },
];

export const gameInfo = (id: GameId): GameInfo => {
  const info = GAME_CATALOG.find((g) => g.id === id);
  if (!info) throw new Error(`unknown game ${id}`);
  return info;
};
