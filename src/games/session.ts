import type { WorldId } from '../config/game';
import { type Difficulty } from '../engine/adaptive';
import { dayKey } from '../engine/dates';
import { chooseTier } from '../engine/distractors';
import { selectGuests } from '../engine/guests';
import type { LevelDef } from '../engine/layout';
import { dueKeys, weakestKeys, type LeitnerState } from '../engine/leitner';
import { planRounds, startRun, type LevelRun } from '../engine/level-run';
import { createRng } from '../engine/rng';
import { GAME_CATALOG } from './catalog';
import { sourceId, type ItemResolver } from './items';
import { practiceItemFor } from './practice';
import type { LevelItem, PlanContext } from './types';

export interface LevelSession {
  /** The level's new items, shown as learn cards. Empty for review levels. */
  learn: LevelItem[];
  /** New items and guests (or the review draw), in play order. */
  items: LevelItem[];
  run: LevelRun;
}

/** Learn levels with content the games can play, and review levels. Boss levels arrive in milestone 6. */
export const isPlayableLevel = (level: LevelDef, resolver: ItemResolver): boolean =>
  level.kind === 'review' ||
  (level.kind === 'learn' && level.itemIds.length > 0 && level.itemIds.every((id) => resolver.byId(id) !== null));

/** Starting difficulty: the world's tier, nudged by how well these items are already known; three options. */
export function startDifficulty(world: WorldId, items: readonly LevelItem[], leitner: LeitnerState): Difficulty {
  const boxes = items.map((i) => leitner[i.key]?.box).filter((b): b is NonNullable<typeof b> => b !== undefined);
  const box = boxes.length > 0 ? Math.round(boxes.reduce((a, b) => a + b, 0) / boxes.length) : undefined;
  return { tier: chooseTier({ world, box }), options: 3 };
}

export interface SessionOptions {
  /** Resolves the level's own items. */
  resolver: ItemResolver;
  /** Resolves guests and review items (narrowed by the reviewed-only setting). Defaults to `resolver`. */
  guestResolver?: ItemResolver;
  ctx: PlanContext;
  today?: string;
  /** Items a review level falls back to before anything is due (the world's own material). */
  reviewFallback?: readonly string[];
}

/** A pair item resolved by id practises the synonym the child knows least. */
function teach(item: LevelItem, leitner: LeitnerState): LevelItem {
  return item.kind === 'pair' ? practiceItemFor(item.entry, leitner) : item;
}

/**
 * Learn levels: learn cards for the level's new items, then rounds over the new items plus ~30% guests.
 * Review levels: no learn cards; due items weakest first (topped up with the weakest known items, then the world's
 * material). Rounds go recognition -> discrimination -> production and are deterministic by seed.
 */
export function buildLevelSession(
  level: LevelDef,
  leitner: LeitnerState,
  seed: string,
  { resolver, guestResolver = resolver, ctx, today = dayKey(), reviewFallback = [] }: SessionOptions,
): LevelSession {
  const rng = createRng(`${seed}:plan`);
  let learn: LevelItem[] = [];
  let items: LevelItem[];
  if (level.kind === 'review') {
    const want = level.drawCount ?? 8;
    const keys = [...new Set([...dueKeys(leitner, today), ...weakestKeys(leitner)])];
    const drawn: LevelItem[] = [];
    const used = new Set<string>();
    const add = (item: LevelItem | null) => {
      if (!item || drawn.length >= want || used.has(sourceId(item))) return;
      used.add(sourceId(item));
      drawn.push(item);
    };
    keys.forEach((k) => add(guestResolver.byKey(k)));
    reviewFallback.forEach((id) => {
      const item = guestResolver.byId(id);
      add(item ? teach(item, leitner) : null);
    });
    items = rng.shuffle(drawn);
  } else {
    learn = level.itemIds.map((id) => resolver.byId(id)).flatMap((i) => (i ? [teach(i, leitner)] : []));
    const guests = selectGuests(leitner, learn.map(sourceId), learn.length, today, guestResolver);
    items = guests.length > 0 ? rng.shuffle([...learn, ...guests]) : learn;
  }
  const rounds = planRounds(level.worldId, GAME_CATALOG, items, rng, ctx);
  return { learn, items, run: startRun(rounds, startDifficulty(level.worldId, items, leitner)) };
}
