import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL_SIZE } from '../src/config/game';
import { buildContent, content, sources, type Entry } from '../src/content';
import { buildLayout, customStation, findLevel, levelSizes, worldLevels } from '../src/engine/layout';
import { LAYOUT_PATH, serializeLayout } from '../scripts/build-layout';

const layout = buildLayout(content);
const learnLevels = layout.worlds.flatMap((w) => w.stations.flatMap((s) => s.levels)).filter((l) => l.kind === 'learn');

describe('levelSizes', () => {
  it('splits into 6-8 where possible and balances the sizes', () => {
    expect(levelSizes(0)).toEqual([]);
    expect(levelSizes(5)).toEqual([5]);
    expect(levelSizes(8)).toEqual([8]);
    expect(levelSizes(13)).toEqual([7, 6]);
    expect(levelSizes(16)).toEqual([8, 8]);
    expect(levelSizes(30)).toEqual([8, 8, 7, 7]);
    for (let n = 12; n <= 80; n++) {
      if (n === 17) continue; // 17 cannot split into parts of 6-8
      for (const s of levelSizes(n)) expect(s, `n=${n}`).toBeGreaterThanOrEqual(LEVEL_SIZE.min);
      for (const s of levelSizes(n)) expect(s, `n=${n}`).toBeLessThanOrEqual(LEVEL_SIZE.max);
    }
  });

  it('never loses an item', () => {
    for (let n = 0; n <= 100; n++) expect(levelSizes(n).reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe('buildLayout', () => {
  it('puts every learn level at 6-8 items with the current content', () => {
    for (const l of learnLevels) {
      expect(l.itemIds.length, l.id).toBeGreaterThanOrEqual(LEVEL_SIZE.min);
      expect(l.itemIds.length, l.id).toBeLessThanOrEqual(LEVEL_SIZE.max);
    }
  });

  it('teaches every entry and every world 3-4 item exactly once', () => {
    const taught = learnLevels.flatMap((l) => l.itemIds);
    expect(new Set(taught).size).toBe(taught.length);
    const expected = [
      ...content.entries.map((e) => e.id),
      ...content.scales.map((s) => s.id),
      ...content.registers.map((r) => r.id),
      ...content.contexts.map((c) => c.id),
      ...content.idioms.map((i) => i.id),
    ];
    expect(new Set(taught)).toEqual(new Set(expected));
  });

  it('assigns difficulty 1 booklet entries to world 1 and the rest to world 2', () => {
    const byId = new Map(content.entries.map((e) => [e.id, e]));
    const w1 = layout.worlds[0]!.stations.flatMap((s) => s.levels.flatMap((l) => l.itemIds)).map((id) => byId.get(id)!);
    const w2 = layout.worlds[1]!.stations.flatMap((s) => s.levels.flatMap((l) => l.itemIds)).map((id) => byId.get(id)!);
    expect(w1.every((e) => e.source === 'booklet' && e.difficulty === 1)).toBe(true);
    expect(w2.every((e) => e.source === 'extra' || e.difficulty >= 2)).toBe(true);
  });

  it('follows the booklet category order and gives heavy categories more levels', () => {
    const w2 = layout.worlds[1]!;
    expect(w2.stations.map((s) => s.categoryId)).toEqual(sources.booklet.categories.map((c) => c.id));
    const levels = (id: string) => w2.stations.find((s) => s.categoryId === id)!.levels.length;
    expect(levels('things-nature-ideas')).toBeGreaterThan(levels('description'));
  });

  it('ends every world with a 15-item boss and finds levels by id', () => {
    for (const w of layout.worlds) {
      expect(worldLevels(w).at(-1)).toEqual(w.boss);
      expect(w.boss.drawCount).toBe(15);
    }
    expect(findLevel(layout, 'w1-emotions-1')?.station?.title).toBe('רגשות ותחושות');
    expect(findLevel(layout, 'w4-boss')?.level.kind).toBe('boss');
    expect(findLevel(layout, 'nope')).toBeNull();
  });

  it('builds a runtime station for custom words', () => {
    const custom: Entry = {
      id: 'c1',
      categoryId: 'custom',
      headword: 'מגניב',
      hint: null,
      synonyms: ['אחלה'],
      difficulty: 1,
      pos: 'adj',
      source: 'custom',
      reviewed: true,
    };
    expect(customStation(content)).toBeNull();
    expect(customStation(buildContent({ ...sources, custom: [custom] }))?.levels[0]?.itemIds).toEqual(['c1']);
  });

  it('matches the committed src/generated/layout.json (run npm run build:layout)', () => {
    expect(readFileSync(LAYOUT_PATH, 'utf8')).toBe(serializeLayout());
  });
});
