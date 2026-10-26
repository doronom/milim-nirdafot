import type { WorldId } from '../config/game';
import type { Content, Entry } from '../content/types';
import { type Difficulty } from '../engine/adaptive';
import { dayKey } from '../engine/dates';
import { chooseTier } from '../engine/distractors';
import { selectGuests } from '../engine/guests';
import type { LevelDef } from '../engine/layout';
import type { LeitnerState } from '../engine/leitner';
import { planStages, startRun, type LevelRun } from '../engine/level-run';
import { createRng } from '../engine/rng';
import { practiceItemFor } from './practice';
import { GAME_CATALOG } from './catalog';
import type { PracticeItem } from './types';

export interface LevelSession {
  /** The level's new entries (learn cards). */
  entries: Entry[];
  /** New items and guests, in play order. */
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

export interface SessionOptions {
  /** Entries guests may come from (the reviewed-only subset when that setting is on). */
  guestPool?: readonly Entry[];
  today?: string;
}

/**
 * Learn cards for the level's new entries, then 3 rounds (recognition, discrimination, production) over the new items
 * plus ~30% guests (due items from earlier levels), deterministic by seed. Guests skip the learn cards.
 */
export function buildLevelSession(
  level: LevelDef,
  content: Content,
  leitner: LeitnerState,
  seed: string,
  { guestPool = content.entries, today = dayKey() }: SessionOptions = {},
): LevelSession {
  const byId = new Map(content.entries.map((e) => [e.id, e]));
  const entries = level.itemIds.map((id) => byId.get(id)!).filter(Boolean);
  const fresh = entries.map((e) => practiceItemFor(e, leitner));
  const guests = selectGuests(leitner, level.itemIds, fresh.length, today, guestPool);
  const rng = createRng(`${seed}:plan`);
  const items = guests.length > 0 ? rng.shuffle([...fresh, ...guests]) : fresh;
  const stages = planStages(level.worldId, GAME_CATALOG, items, rng, content);
  return { entries, items, run: startRun(stages, items, startDifficulty(level.worldId, items, leitner)) };
}
