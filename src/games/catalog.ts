import type { GameId } from '../config/game';
import type { GameInfo } from '../engine/level-run';
import { canHostOdd } from './oddOneOut/build';
import { swapSentences } from './swapWord/build';
import { wordSearchPlayable } from './wordSearch/build';

/**
 * Stages, sizes and playable items of every game: enough to plan a level without an environment.
 * World 1: pickSynonym, dragPairs, memory. World 2 adds wordSearch, oddOneOut, swapWord.
 */
export const GAME_CATALOG: readonly GameInfo[] = [
  { id: 'pickSynonym', stage: 'recognition', minItems: 1 },
  { id: 'wordSearch', stage: 'recognition', minItems: 4, playable: wordSearchPlayable },
  { id: 'dragPairs', stage: 'discrimination', minItems: 2 },
  { id: 'oddOneOut', stage: 'discrimination', minItems: 3, playable: (items) => items.filter(canHostOdd) },
  { id: 'memory', stage: 'production', minItems: 3 },
  // swapWord uses reviewed sentences only, so it joins a level once the parent has approved sentences.
  {
    id: 'swapWord',
    stage: 'production',
    minItems: 2,
    playable: (items, content) => items.filter((i) => swapSentences({ content }, i).length > 0),
  },
];

/** The game used for extra review rounds of missed items. */
export const REVIEW_GAME: GameId = 'pickSynonym';
