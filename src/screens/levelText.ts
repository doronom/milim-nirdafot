import type { LevelDef, StationDef } from '../engine/layout';

/** "1.2" style label: station index, level index. */
export const levelNumber = (level: LevelDef, station?: StationDef): string =>
  station ? `${station.index}.${level.index}` : '';

export function levelTitle(level: LevelDef, station?: StationDef): string {
  if (level.kind === 'boss') return 'קרב הבוס';
  if (level.kind === 'review') return 'חזרה';
  if (level.index === 1) return 'היכרות';
  if (station && level.index === station.levels.length) return 'אתגר';
  return 'תרגול';
}
