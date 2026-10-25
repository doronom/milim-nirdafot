import type { WorldId } from '../config/game';
import type { Content, Entry } from '../content/types';
import { type Difficulty } from '../engine/adaptive';
import { chooseTier } from '../engine/distractors';
import type { LevelDef } from '../engine/layout';
import type { LeitnerState } from '../engine/leitner';
import { planStages, startRun, type LevelRun } from '../engine/level-run';
import { createRng } from '../engine/rng';
import { practiceItemFor } from './practice';
import { GAME_CATALOG } from './registry';
import type { PracticeItem } from './types';

export interface LevelSession {
  entries: Entry[];
  items: PracticeItem[];
  run: LevelRun;
}

/** Levels whose items are entries (worlds 1-2 and custom words) can be played with the World 1-2 games. */
export const isEntryLevel = (level: LevelDef, content: Content): boolean =>
  level.kind === 'learn' &&
  level.itemIds.length > 0 &&
  level.itemIds.every((id) => content.entries.some((e) => e.id === id));

/** Starting difficulty: the world's tier, nudged by how well these pairs are already known; three options. */
export function startDifficulty(world: WorldId, items: PracticeItem[], leitner: LeitnerState): Difficulty {
  const boxes = items.map((i) => leitner[i.key]?.box).filter((b): b is NonNullable<typeof b> => b !== undefined);
  const box = boxes.length > 0 ? Math.round(boxes.reduce((a, b) => a + b, 0) / boxes.length) : undefined;
  return { tier: chooseTier({ world, box }), options: 3 };
}

/** Learn cards for the level's entries, then 3 rounds (recognition, discrimination, production), deterministic by seed. */
export function buildLevelSession(
  level: LevelDef,
  content: Content,
  leitner: LeitnerState,
  seed: string,
): LevelSession {
  const byId = new Map(content.entries.map((e) => [e.id, e]));
  const entries = level.itemIds.map((id) => byId.get(id)!).filter(Boolean);
  const items = entries.map((e) => practiceItemFor(e, leitner));
  const stages = planStages(level.worldId, GAME_CATALOG, items.length, createRng(`${seed}:plan`));
  return { entries, items, run: startRun(stages, items, startDifficulty(level.worldId, items, leitner)) };
}
