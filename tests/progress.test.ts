import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { buildLayout, worldLevels } from '../src/engine/layout';
import {
  activeWorld,
  currentLevel,
  initialProgress,
  isLevelUnlocked,
  isWorldUnlocked,
  totalStars,
  worldStats,
  type Progress,
} from '../src/engine/progress';

const layout = buildLayout(content);
const w1 = layout.worlds[0]!;
const levels = worldLevels(w1);
const done = (p: Progress, ids: string[]): Progress => ({
  ...p,
  levels: {
    ...p.levels,
    ...Object.fromEntries(ids.map((id) => [id, { stars: 2 as const, bestAccuracy: 0.9, completedAt: '2026-10-25' }])),
  },
});

describe('progress rules', () => {
  it('opens world 1 only, and its first level only', () => {
    const p = initialProgress();
    expect([1, 2, 3, 4].map((w) => isWorldUnlocked(p, w as 1))).toEqual([true, false, false, false]);
    expect(isLevelUnlocked(p, w1, levels[0]!.id)).toBe(true);
    expect(isLevelUnlocked(p, w1, levels[1]!.id)).toBe(false);
    expect(currentLevel(p, w1)?.id).toBe('w1-emotions-1');
  });

  it('opens levels in order across stations', () => {
    const firstStation = w1.stations[0]!.levels.map((l) => l.id);
    const p = done(initialProgress(), firstStation);
    expect(isLevelUnlocked(p, w1, w1.stations[1]!.levels[0]!.id)).toBe(true);
    expect(isLevelUnlocked(p, w1, w1.stations[1]!.levels[1]!.id)).toBe(false);
    expect(worldStats(p, w1).stationsDone).toBe(1);
  });

  it('opens the boss only after every level, and then points to it', () => {
    const allButBoss = levels.slice(0, -1).map((l) => l.id);
    expect(isLevelUnlocked(done(initialProgress(), allButBoss.slice(0, -1)), w1, w1.boss.id)).toBe(false);
    const p = done(initialProgress(), allButBoss);
    expect(isLevelUnlocked(p, w1, w1.boss.id)).toBe(true);
    expect(currentLevel(p, w1)?.id).toBe(w1.boss.id);
  });

  it('honours unlocked worlds and the unlock-all setting', () => {
    const p = { ...initialProgress(), unlockedWorlds: [1, 2] as Progress['unlockedWorlds'] };
    expect(isWorldUnlocked(p, 2)).toBe(true);
    expect(activeWorld(p, layout).id).toBe(2);
    const all = { ...initialProgress(), settings: { unlockAll: true } };
    expect(isLevelUnlocked(all, layout.worlds[3]!, layout.worlds[3]!.boss.id)).toBe(true);
  });

  it('counts stars', () => {
    const p = done(initialProgress(), [levels[0]!.id, levels[1]!.id]);
    expect(totalStars(p)).toBe(4);
    expect(worldStats(p, w1).stars).toBe(4);
    expect(worldStats(p, w1).maxStars).toBe(levels.length * 3);
  });
});
