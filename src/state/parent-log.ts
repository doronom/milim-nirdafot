import type { KeyValueStore } from '../storage/kv';

export const LOG_KEY = 'parent:log';
/** Entries kept, newest first beyond this are dropped. */
export const LOG_LIMIT = 1000;

/**
 * entry / entry-failed / lockout: the gate. recovery / recovery-failed: the recovery code. passcode: set or changed.
 * change: anything the parent changed (settings, reset, approvals, edits, hidden items, words, backups).
 */
export type LogKind = 'entry' | 'entry-failed' | 'lockout' | 'recovery' | 'recovery-failed' | 'passcode' | 'change';

export interface LogEntry {
  /** ISO time. */
  at: string;
  kind: LogKind;
  /** What happened, in Hebrew. */
  text: string;
}

const queues = new WeakMap<KeyValueStore, Promise<unknown>>();

/** Store writes run one after another, so two entries logged together never overwrite each other. */
function serial<T>(store: KeyValueStore, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(store) ?? Promise.resolve()).then(task, task);
  queues.set(
    store,
    run.catch(() => undefined),
  );
  return run;
}

export const listLog = async (store: KeyValueStore): Promise<LogEntry[]> =>
  (await store.get<LogEntry[]>(LOG_KEY)) ?? [];

/** Adds an entry (newest last). Logging never throws into the caller. */
export function appendLog(store: KeyValueStore, kind: LogKind, text: string, now = new Date()): Promise<void> {
  return serial(store, async () => {
    const log = await listLog(store);
    await store.set(LOG_KEY, [...log, { at: now.toISOString(), kind, text }].slice(-LOG_LIMIT));
  }).catch(() => undefined);
}

export const isFailure = (e: LogEntry): boolean => e.kind === 'entry-failed' || e.kind === 'recovery-failed';

/** Wrong attempts since the parent's previous successful entry (the one before the current visit). */
export function failedSincePreviousEntry(log: readonly LogEntry[]): number {
  const entries = log.flatMap((e, i) => (e.kind === 'entry' || e.kind === 'recovery' ? [i] : []));
  const from = entries.length >= 2 ? entries[entries.length - 2]! : -1;
  const to = entries.length >= 1 ? entries[entries.length - 1]! : log.length;
  return log.slice(from + 1, to).filter(isFailure).length;
}
