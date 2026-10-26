import { BOSS_SIZE, LEVEL_SIZE, STATION_TITLES, WORLDS, type WorldId } from '../config/game';
import { CUSTOM_CATEGORY_ID } from '../content/model';
import type { Content } from '../content/types';

export type StationKind = 'category' | 'scales' | 'registers' | 'contexts' | 'idioms' | 'review' | 'custom';

/** What a level teaches. Review and boss levels pick their items at runtime from the Leitner boxes. */
export type LevelKind = 'learn' | 'review' | 'boss';

export interface LevelDef {
  id: string;
  worldId: WorldId;
  stationId: string;
  /** 1-based position inside the station; the UI shows "station.level", e.g. 1.2. */
  index: number;
  kind: LevelKind;
  /** Ids of the entries, scales, register sets, context choices or idioms taught here. Empty for review and boss. */
  itemIds: string[];
  /** Items to draw at runtime for review and boss levels. */
  drawCount?: number;
}

export interface StationDef {
  id: string;
  worldId: WorldId;
  /** 1-based position in the world. */
  index: number;
  kind: StationKind;
  title: string;
  categoryId?: string;
  levels: LevelDef[];
}

export interface WorldDef {
  id: WorldId;
  stations: StationDef[];
  boss: LevelDef;
}

export interface Layout {
  worlds: WorldDef[];
}

/** Splits n items into level sizes within LEVEL_SIZE where possible, otherwise the closest fit. */
export function levelSizes(n: number): number[] {
  if (n === 0) return [];
  let k = Math.ceil(n / LEVEL_SIZE.max);
  if (k * LEVEL_SIZE.min > n) k = Math.max(1, Math.floor(n / LEVEL_SIZE.min));
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

function chunk(ids: string[]): string[][] {
  const out: string[][] = [];
  let at = 0;
  for (const size of levelSizes(ids.length)) {
    out.push(ids.slice(at, at + size));
    at += size;
  }
  return out;
}

function station(
  worldId: WorldId,
  index: number,
  kind: StationKind,
  key: string,
  title: string,
  itemIds: string[],
  categoryId?: string,
): StationDef {
  const id = `w${worldId}-${key}`;
  return {
    id,
    worldId,
    index,
    kind,
    title,
    categoryId,
    levels: chunk(itemIds).map((ids, i) => ({
      id: `${id}-${i + 1}`,
      worldId,
      stationId: id,
      index: i + 1,
      kind: 'learn',
      itemIds: ids,
    })),
  };
}

function reviewStation(worldId: WorldId, index: number, title: string, levels: number, drawCount: number): StationDef {
  const id = `w${worldId}-review`;
  return {
    id,
    worldId,
    index,
    kind: 'review',
    title,
    levels: Array.from({ length: levels }, (_, i) => ({
      id: `${id}-${i + 1}`,
      worldId,
      stationId: id,
      index: i + 1,
      kind: 'review',
      itemIds: [],
      drawCount,
    })),
  };
}

const boss = (worldId: WorldId): LevelDef => ({
  id: `w${worldId}-boss`,
  worldId,
  stationId: `w${worldId}-boss`,
  index: 1,
  kind: 'boss',
  itemIds: [],
  drawCount: BOSS_SIZE,
});

/**
 * The world / station / level layout, derived from the content. Worlds 1-2 have one station per booklet category
 * (world 1: booklet difficulty 1; world 2: booklet difficulty 2-3 plus the extra entries). Worlds 3-4 group stations by
 * content type. Generated at build time into src/generated/layout.json; custom words get a runtime station.
 */
export function buildLayout(content: Content): Layout {
  const categories = [...content.categories]
    .filter((c) => c.id !== CUSTOM_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);

  const categoryStations = (worldId: WorldId, pick: (e: Content['entries'][number]) => boolean) =>
    categories
      .map((c) => ({ c, ids: content.entries.filter((e) => e.categoryId === c.id && pick(e)).map((e) => e.id) }))
      .filter(({ ids }) => ids.length > 0)
      .map(({ c, ids }, i) => station(worldId, i + 1, 'category', c.id, STATION_TITLES[c.id] ?? c.title, ids, c.id));

  const world1 = categoryStations(1, (e) => e.source === 'booklet' && e.difficulty === 1);
  const world2 = categoryStations(2, (e) => (e.source === 'booklet' && e.difficulty >= 2) || e.source === 'extra');
  const world3 = [
    station(
      3,
      1,
      'scales',
      'scales',
      'סולמות עוצמה',
      content.scales.map((s) => s.id),
    ),
    station(
      3,
      2,
      'registers',
      'registers',
      'משלבי לשון',
      content.registers.map((r) => r.id),
    ),
    station(
      3,
      3,
      'contexts',
      'contexts',
      'המילה המתאימה',
      content.contexts.map((c) => c.id),
    ),
    reviewStation(3, 4, 'חזרה כללית', 2, LEVEL_SIZE.max),
  ];
  const world4 = [
    station(
      4,
      1,
      'idioms',
      'idioms',
      'ניבים וצירופים',
      content.idioms.map((i) => i.id),
    ),
    reviewStation(4, 2, 'חזרה מעורבת', 3, LEVEL_SIZE.max),
  ];

  const stations: Record<WorldId, StationDef[]> = { 1: world1, 2: world2, 3: world3, 4: world4 };
  return { worlds: WORLDS.map((w) => ({ id: w.id, stations: stations[w.id], boss: boss(w.id) })) };
}

/** The custom-words station, added at runtime because the parent's words live on the device. */
export function customStation(content: Content, worldId: WorldId = 1): StationDef | null {
  const ids = content.entries.filter((e) => e.source === 'custom').map((e) => e.id);
  if (ids.length === 0) return null;
  return station(worldId, 99, 'custom', CUSTOM_CATEGORY_ID, 'המילים שלי', ids);
}

/** Every level of a world in play order, boss last. */
export const worldLevels = (world: WorldDef): LevelDef[] => [...world.stations.flatMap((s) => s.levels), world.boss];

export function findLevel(
  layout: Layout,
  levelId: string,
): { world: WorldDef; station?: StationDef; level: LevelDef } | null {
  for (const world of layout.worlds) {
    if (world.boss.id === levelId) return { world, level: world.boss };
    for (const station of world.stations) {
      const level = station.levels.find((l) => l.id === levelId);
      if (level) return { world, station, level };
    }
  }
  return null;
}
