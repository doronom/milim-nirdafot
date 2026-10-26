import type { WorldId } from '../config/game';
import type { IconName } from '../ui/icons';
import { worldLevels, type Layout, type LevelDef } from './layout';
import type { Progress } from './progress';

/** One collectible: every level awards the sticker of its slot. */
export interface Sticker {
  levelId: string;
  worldId: WorldId;
  /** A word from the level (its first item's label), so every sticker is different and tied to what was learned. */
  name: string;
  icon: IconName;
  /** The boss sticker of a world is golden. */
  golden: boolean;
}

const WORLD_ICONS: Record<WorldId, IconName[]> = {
  1: ['anchor', 'compass', 'map', 'key', 'star', 'shield'],
  2: ['trees', 'sparkle', 'flame', 'book', 'star', 'compass'],
  3: ['mountain', 'bolt', 'shield', 'key', 'star', 'sparkle'],
  4: ['tower', 'crown', 'book', 'trophy', 'star', 'bolt'],
};

/** All stickers of a world, in path order, boss last. */
export function worldStickers(layout: Layout, world: WorldId, labelOf: (level: LevelDef) => string): Sticker[] {
  const def = layout.worlds.find((w) => w.id === world)!;
  return worldLevels(def).map((level, i) => ({
    levelId: level.id,
    worldId: world,
    name: level.kind === 'boss' ? 'גביע הבוס' : labelOf(level),
    icon: level.kind === 'boss' ? 'crown' : WORLD_ICONS[world][i % WORLD_ICONS[world].length]!,
    golden: level.kind === 'boss',
  }));
}

/** Earned: the level is done. Placed: the child has stuck it into its slot. Waiting: earned, not placed yet. */
export function stickerState(p: Progress, levelId: string): 'locked' | 'waiting' | 'placed' {
  if (!((p.levels[levelId]?.stars ?? 0) > 0)) return 'locked';
  return (p.album?.placed ?? []).includes(levelId) ? 'placed' : 'waiting';
}

export const placeSticker = (p: Progress, levelId: string): Progress =>
  stickerState(p, levelId) === 'waiting' ? { ...p, album: { placed: [...(p.album?.placed ?? []), levelId] } } : p;
