import type { Difficulty } from '../../engine/adaptive';
import type { Rng } from '../../engine/rng';
import { conflictFreeGroups } from '../practice';
import type { GameEnv, PracticeItem } from '../types';

export interface DragBoard {
  /** Draggable chips: the headwords (as in the mockup), shuffled. */
  chips: PracticeItem[];
  /** Drop targets: the synonyms, shuffled separately. */
  targets: PracticeItem[];
}

export interface DragRound {
  boards: DragBoard[];
}

/** 4 pairs per board, 5 once the child is doing well (4+ options). Boards never hold two cross-linked pairs. */
export const pairsPerBoard = (difficulty: Difficulty): number => (difficulty.options >= 4 ? 5 : 4);

export function buildDragRound(env: GameEnv, items: PracticeItem[], difficulty: Difficulty, rng: Rng): DragRound {
  const size = pairsPerBoard(difficulty);
  const groups = conflictFreeGroups(rng.shuffle(items), size, env.links.areLinked);
  return { boards: groups.map((g) => ({ chips: rng.shuffle(g), targets: rng.shuffle(g) })) };
}

/** A chip may land on any target it is directly linked to; boards are built so only its own target qualifies. */
export const dropMatches = (env: GameEnv, chip: PracticeItem, target: PracticeItem): boolean =>
  env.links.areLinked(chip.entry.headword, target.synonym);
