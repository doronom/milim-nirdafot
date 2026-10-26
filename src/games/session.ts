import type { WorldId } from '../config/game';
import type { Entry } from '../content/types';
import { type Difficulty } from '../engine/adaptive';
import { dayKey } from '../engine/dates';
import { chooseTier } from '../engine/distractors';
import { selectGuests } from '../engine/guests';
import type { LevelDef } from '../engine/layout';
import { dueKeys, weakestKeys, type LeitnerState } from '../engine/leitner';
import { planRounds, planSinglePass, startRun, type LevelRun } from '../engine/level-run';
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

/** Learn levels with content the games can play, review levels and boss levels. */
export const isPlayableLevel = (level: LevelDef, resolver: ItemResolver): boolean =>
  level.kind === 'review' ||
  level.kind === 'boss' ||
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
  /** The world's own material (level item ids): review levels fall back to it, boss levels draw from it. */
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
  if (level.kind === 'boss') {
    items = drawBoss(level.drawCount ?? 15, leitner, reviewFallback, guestResolver, rng);
    const rounds = planSinglePass(level.worldId, GAME_CATALOG, items, ctx);
    return { learn, items, run: startRun(rounds, startDifficulty(level.worldId, items, leitner), true) };
  }
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

/** Share of a boss drawn from the weakest Leitner items of the world; the rest is unseen or random world material. */
export const BOSS_WEAK_SHARE = 2 / 3;

/**
 * 15 mixed items from the world, mostly the weakest in the Leitner boxes (lower box, more lapses first), topped up
 * with the world's other material in a seeded random order. One item per source (entry, scale...), shuffled.
 */
export function drawBoss(
  count: number,
  leitner: LeitnerState,
  worldIds: readonly string[],
  resolver: ItemResolver,
  rng: ReturnType<typeof createRng>,
): LevelItem[] {
  const inWorld = new Set(worldIds);
  const drawn: LevelItem[] = [];
  const used = new Set<string>();
  const add = (item: LevelItem | null) => {
    if (!item || drawn.length >= count || used.has(sourceId(item)) || !inWorld.has(sourceId(item))) return;
    used.add(sourceId(item));
    drawn.push(item);
  };
  const weakCap = Math.round(count * BOSS_WEAK_SHARE);
  for (const key of weakestKeys(leitner)) {
    if (drawn.length >= weakCap) break;
    add(resolver.byKey(key));
  }
  for (const id of rng.shuffle([...worldIds])) {
    const item = resolver.byId(id);
    add(item ? teach(item, leitner) : null);
  }
  return rng.shuffle(drawn);
}

export interface PlacementSession {
  items: LevelItem[];
  /** Item keys of the difficulty-1 words: World 2 opens at 85% on these. */
  easyKeys: string[];
}

export const PLACEMENT_MIX = { easy: 10, medium: 6, hard: 4 } as const;
export const PLACEMENT_PASS = 0.85;

/** 20 booklet and extra words across difficulties (10 easy, 6 medium, 4 hard), for the onboarding challenge. */
export function buildPlacement(entries: readonly Entry[], seed: string): PlacementSession {
  const rng = createRng(`${seed}:placement`);
  const pick = (d: 1 | 2 | 3, n: number) =>
    rng
      .shuffle(entries.filter((e) => e.source !== 'custom' && e.difficulty === d))
      .slice(0, n)
      .map((e) => practiceItemFor(e, {}));
  const easy = pick(1, PLACEMENT_MIX.easy);
  const items = rng.shuffle([...easy, ...pick(2, PLACEMENT_MIX.medium), ...pick(3, PLACEMENT_MIX.hard)]);
  return { items, easyKeys: easy.map((i) => i.key) };
}

/** World 2 opens when 85% or more of the difficulty-1 answers are right. */
export function placementUnlocks(
  answers: readonly { itemKey: string; outcome: string }[],
  easyKeys: readonly string[],
): boolean {
  const easy = answers.filter((a) => easyKeys.includes(a.itemKey));
  if (easy.length === 0) return false;
  return easy.filter((a) => a.outcome !== 'wrong').length / easy.length >= PLACEMENT_PASS;
}
