import { type WorldId } from '../config/game';
import type { LeitnerState } from './leitner';
import { worldLevels, type Layout, type LevelDef, type WorldDef } from './layout';

export type Stars = 0 | 1 | 2 | 3;

export interface LevelResult {
  stars: Stars;
  bestAccuracy: number;
  completedAt: string;
}

/** Everything persisted about the player's journey. Versioned so a backup can be migrated. */
export interface Progress {
  version: 1;
  levels: Record<string, LevelResult>;
  /** Worlds opened by passing the previous boss or by the placement challenge. */
  unlockedWorlds: WorldId[];
  xp: number;
  streak: { days: number; freezes: number; lastPlayed: string | null };
  /** Leitner boxes per practice item key. */
  leitner: LeitnerState;
  settings: {
    unlockAll: boolean;
    /** "Reviewed words only": unreviewed entries are left out. */
    reviewedOnly: boolean;
    /** "Reviewed sentences only": swapWord skips unreviewed sentences (default off; reported ones are out anyway). */
    reviewedSentencesOnly?: boolean;
  };
}

export const initialProgress = (): Progress => ({
  version: 1,
  levels: {},
  unlockedWorlds: [1],
  xp: 0,
  streak: { days: 0, freezes: 1, lastPlayed: null },
  leitner: {},
  settings: { unlockAll: false, reviewedOnly: false, reviewedSentencesOnly: false },
});

export const isWorldUnlocked = (p: Progress, world: WorldId): boolean =>
  world === 1 || p.settings.unlockAll || p.unlockedWorlds.includes(world);

export const isLevelDone = (p: Progress, levelId: string): boolean => (p.levels[levelId]?.stars ?? 0) > 0;

/** Levels open in order inside a world; the boss opens once every other level of the world is done. */
export function isLevelUnlocked(p: Progress, world: WorldDef, levelId: string): boolean {
  if (!isWorldUnlocked(p, world.id)) return false;
  if (p.settings.unlockAll) return true;
  const levels = worldLevels(world);
  const i = levels.findIndex((l) => l.id === levelId);
  if (i <= 0) return i === 0;
  if (levelId === world.boss.id) return levels.slice(0, -1).every((l) => isLevelDone(p, l.id));
  return isLevelDone(p, levels[i - 1]!.id);
}

/** The next level to play: the first unlocked level that is not done yet, or the boss. */
export function currentLevel(p: Progress, world: WorldDef): LevelDef | null {
  return worldLevels(world).find((l) => isLevelUnlocked(p, world, l.id) && !isLevelDone(p, l.id)) ?? null;
}

export interface WorldStats {
  levelsDone: number;
  levelsTotal: number;
  stationsDone: number;
  stationsTotal: number;
  stars: number;
  maxStars: number;
}

export function worldStats(p: Progress, world: WorldDef): WorldStats {
  const levels = worldLevels(world);
  const done = levels.filter((l) => isLevelDone(p, l.id));
  return {
    levelsDone: done.length,
    levelsTotal: levels.length,
    stationsDone: world.stations.filter((s) => s.levels.every((l) => isLevelDone(p, l.id))).length,
    stationsTotal: world.stations.length,
    stars: done.reduce((sum, l) => sum + (p.levels[l.id]?.stars ?? 0), 0),
    maxStars: levels.length * 3,
  };
}

/** The world the player is currently working in: the highest unlocked world that is not finished. */
export function activeWorld(p: Progress, layout: Layout): WorldDef {
  const open = layout.worlds.filter((w) => isWorldUnlocked(p, w.id));
  return [...open].reverse().find((w) => currentLevel(p, w) !== null) ?? open.at(-1) ?? layout.worlds[0]!;
}

export const totalStars = (p: Progress): number => Object.values(p.levels).reduce((s, r) => s + r.stars, 0);

export interface CompletedLevel {
  levelId: string;
  stars: Stars;
  accuracy: number;
  xp: number;
  leitner: LeitnerState;
  completedAt: string;
}

/** Records a finished level: best stars and accuracy are kept, XP adds up, and the Leitner boxes are replaced. */
export function recordLevel(p: Progress, done: CompletedLevel): Progress {
  const prev = p.levels[done.levelId];
  return {
    ...p,
    xp: p.xp + done.xp,
    leitner: done.leitner,
    levels: {
      ...p.levels,
      [done.levelId]: {
        stars: Math.max(prev?.stars ?? 0, done.stars) as Stars,
        bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, done.accuracy),
        completedAt: done.completedAt,
      },
    },
  };
}
