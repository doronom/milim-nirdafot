import {
  ATTEMPTS_PER_ROUND,
  initialLockout,
  lockedFor,
  registerFailure,
  registerSuccess,
  verifyPasscode,
  type HashRecord,
  type LockoutState,
} from '../engine/passcode';
import type { KeyValueStore } from '../storage/kv';
import { appendLog } from './parent-log';

export const LOCK_KEY = 'parent:lock';
export const LOCKOUT_KEY = 'parent:lockout';

/**
 * The passcode hash this device checks entries against (salted PBKDF2, never the passcode). It is set in parent mode
 * on a parent's phone and arrives with pairing and sync ("cloud"). "local" is a passcode set on the device before cloud
 * sync existed; it keeps working until the device is paired, which replaces it.
 */
export interface ParentLock {
  passcode: HashRecord;
  source: 'local' | 'cloud';
  changedAt: string;
  /** For cloud hashes: when parent mode last set it (epoch ms), to apply only newer ones. */
  cloudUpdatedAt?: number;
}

export type AttemptResult = { kind: 'ok' } | { kind: 'wrong'; left: number } | { kind: 'locked'; until: number };

/** Reads the lock; records from before cloud sync have no source and count as local. */
export async function getLock(store: KeyValueStore): Promise<ParentLock | undefined> {
  const lock = await store.get<Partial<ParentLock> & { passcode?: HashRecord; changedAt?: string }>(LOCK_KEY);
  if (!lock?.passcode) return undefined;
  return {
    passcode: lock.passcode,
    source: lock.source ?? 'local',
    changedAt: lock.changedAt ?? new Date(0).toISOString(),
    cloudUpdatedAt: lock.cloudUpdatedAt,
  };
}

export const getLockout = async (store: KeyValueStore): Promise<LockoutState> =>
  (await store.get<LockoutState>(LOCKOUT_KEY)) ?? initialLockout();

/** A fixed clock for tests. */
export interface LockOptions {
  now?: () => number;
}

const clock = (o: LockOptions) => o.now ?? Date.now;
const minutes = (ms: number) => Math.round(ms / 60_000);

/**
 * Installs the passcode hash from parent mode (at pairing, then whenever a newer one syncs). Replaces a local passcode
 * from before cloud sync. The lockout stays as it is: it belongs to this device. Returns whether anything changed.
 */
export async function installCloudPasscode(
  store: KeyValueStore,
  passcode: HashRecord,
  updatedAt: number,
  o: LockOptions = {},
): Promise<boolean> {
  const current = await getLock(store);
  if (current?.source === 'cloud' && (current.cloudUpdatedAt ?? 0) >= updatedAt) return false;
  const now = clock(o)();
  await store.set<ParentLock>(LOCK_KEY, {
    passcode,
    source: 'cloud',
    changedAt: new Date(now).toISOString(),
    cloudUpdatedAt: updatedAt,
  });
  const text = !current
    ? 'התקבל קוד ההורים מהטלפון של ההורה'
    : current.source === 'local'
      ? 'קוד ההורים המקומי הוחלף בקוד שנקבע בטלפון של ההורה'
      : 'קוד ההורים עודכן מהטלפון של ההורה';
  await appendLog(store, 'passcode', text, new Date(now));
  return true;
}

/**
 * One passcode attempt: refused while locked; a wrong one counts towards the next lockout (every third: 1, 5, 15,
 * then 60 minutes); the right one clears the count. Logged either way. Works offline: the hash is on the device.
 */
export async function tryPasscode(store: KeyValueStore, passcode: string, o: LockOptions = {}): Promise<AttemptResult> {
  const now = clock(o)();
  const lock = await getLock(store);
  if (!lock) throw new Error('no passcode on this device');
  const state = await getLockout(store);
  if (lockedFor(state, now) > 0) return { kind: 'locked', until: state.lockedUntil! };
  if (await verifyPasscode(passcode, lock.passcode)) {
    await store.set(LOCKOUT_KEY, registerSuccess());
    await appendLog(store, 'entry', 'כניסה לאזור ההורים', new Date(now));
    return { kind: 'ok' };
  }
  const next = registerFailure(state, now);
  await store.set(LOCKOUT_KEY, next);
  await appendLog(store, 'entry-failed', 'ניסיון כניסה עם קוד שגוי', new Date(now));
  if (next.lockedUntil !== null && next.lockedUntil > now) {
    await appendLog(store, 'lockout', `הכניסה ננעלה ל־${minutes(next.lockedUntil - now)} דקות`, new Date(now));
    return { kind: 'locked', until: next.lockedUntil };
  }
  return { kind: 'wrong', left: ATTEMPTS_PER_ROUND - next.failures };
}
