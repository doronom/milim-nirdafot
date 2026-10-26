import type { ContentOverrides } from '../content/overrides';
import type { Layout } from '../engine/layout';
import { isLevelDone, worldStats, type Progress } from '../engine/progress';
import type { AlsoCorrectReport, ItemDispute } from '../engine/review-queue';
import type { SentenceReport } from '../engine/sentence-reports';
import type { LogEntry } from '../state/parent-log';

export const SNAPSHOT_SCHEMA = 1;
/** Firestore documents are capped at 1 MiB; the snapshot stays well under it by trimming the oldest log entries. */
export const SNAPSHOT_MAX_BYTES = 800_000;

export interface StationStats {
  id: string;
  title: string;
  done: number;
  total: number;
}

export interface WorldSnapshot {
  id: number;
  levelsDone: number;
  levelsTotal: number;
  stationsDone: number;
  stationsTotal: number;
  stars: number;
  stations: StationStats[];
}

/**
 * What a paired child device uploads: progress (Leitner boxes, levels, XP, streak, minutes per day), per-world and
 * per-station stats, the parent-area activity log, the review queues and the content overrides (the parent's words and
 * edits, for labels now and for parent-side editing later). Never voice recordings, the lockout, the passcode hash or
 * any recovery data; the child's name travels separately, as a first name only.
 */
export interface ChildSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  progress: Omit<Progress, 'settings'> & { settings: Omit<Progress['settings'], 'childName'> };
  worlds: WorldSnapshot[];
  log: LogEntry[];
  queues: { alsoCorrect: AlsoCorrectReport[]; sentenceReports: SentenceReport[]; itemDisputes: ItemDispute[] };
  overrides: ContentOverrides;
}

export interface SnapshotInput {
  progress: Progress;
  overrides: ContentOverrides;
  log: readonly LogEntry[];
  queues: ChildSnapshot['queues'];
  layout: Layout;
}

/** First name only: the first word, at most 30 characters. */
export const firstName = (name: string | undefined): string => (name ?? '').trim().split(/\s+/)[0]!.slice(0, 30);

/** Drops `undefined` (Firestore rejects it) and anything that is not plain data. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function buildSnapshot({ progress, overrides, log, queues, layout }: SnapshotInput): ChildSnapshot {
  const { childName: _name, ...settings } = progress.settings;
  void _name;
  const worlds = layout.worlds.map((world): WorldSnapshot => {
    const stats = worldStats(progress, world);
    return {
      id: world.id,
      levelsDone: stats.levelsDone,
      levelsTotal: stats.levelsTotal,
      stationsDone: stats.stationsDone,
      stationsTotal: stats.stationsTotal,
      stars: stats.stars,
      stations: world.stations.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.levels.filter((l) => isLevelDone(progress, l.id)).length,
        total: s.levels.length,
      })),
    };
  });
  let snapshot: ChildSnapshot = plain({
    schema: SNAPSHOT_SCHEMA,
    progress: { ...progress, settings },
    worlds,
    log: [...log],
    queues,
    overrides,
  });
  while (JSON.stringify(snapshot).length > SNAPSHOT_MAX_BYTES && snapshot.log.length > 0)
    snapshot = { ...snapshot, log: snapshot.log.slice(Math.ceil(snapshot.log.length / 2)) };
  return snapshot;
}

/** Store keys and values that let the parent dashboard render a snapshot as if it were on this device. */
export function snapshotStore(snapshot: ChildSnapshot, name: string): Record<string, unknown> {
  return {
    progress: { ...snapshot.progress, settings: { ...snapshot.progress.settings, childName: name } },
    'content:overrides': snapshot.overrides,
    'parent:log': snapshot.log,
    'review:also-correct': snapshot.queues.alsoCorrect,
    'review:sentence-reports': snapshot.queues.sentenceReports,
    'review:item-disputes': snapshot.queues.itemDisputes,
  };
}
