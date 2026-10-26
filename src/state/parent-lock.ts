import {
  ATTEMPTS_PER_ROUND,
  hashPasscode,
  hashRecoveryCode,
  initialLockout,
  lockedFor,
  registerFailure,
  registerSuccess,
  verifyPasscode,
  verifyRecoveryCode,
  type HashRecord,
  type LockoutState,
} from '../engine/passcode';
import type { KeyValueStore } from '../storage/kv';
import { appendLog } from './parent-log';

export const LOCK_KEY = 'parent:lock';
export const LOCKOUT_KEY = 'parent:lockout';

/** What the device stores about the parent passcode: salted hashes only. */
export interface ParentLock {
  passcode: HashRecord;
  recovery: HashRecord;
  createdAt: string;
  changedAt: string;
}

export type AttemptResult = { kind: 'ok' } | { kind: 'wrong'; left: number } | { kind: 'locked'; until: number };

export const getLock = (store: KeyValueStore): Promise<ParentLock | undefined> => store.get<ParentLock>(LOCK_KEY);
export const getLockout = async (store: KeyValueStore): Promise<LockoutState> =>
  (await store.get<LockoutState>(LOCKOUT_KEY)) ?? initialLockout();

/** Options for tests: a lower PBKDF2 cost and a fixed clock. */
export interface LockOptions {
  iterations?: number;
  now?: () => number;
}

const clock = (o: LockOptions) => o.now ?? Date.now;
const minutes = (ms: number) => Math.round(ms / 60_000);

/** Saves a new passcode and recovery code (as hashes). Used at setup, after recovery and when changing it. */
async function saveLock(
  store: KeyValueStore,
  passcode: string,
  recoveryCode: string,
  o: LockOptions,
  keepCreated?: string,
) {
  const at = new Date(clock(o)()).toISOString();
  const [p, r] = await Promise.all([
    hashPasscode(passcode, o.iterations),
    hashRecoveryCode(recoveryCode, o.iterations),
  ]);
  await store.set<ParentLock>(LOCK_KEY, { passcode: p, recovery: r, createdAt: keepCreated ?? at, changedAt: at });
  await store.set(LOCKOUT_KEY, initialLockout());
}

export async function setupLock(store: KeyValueStore, passcode: string, recoveryCode: string, o: LockOptions = {}) {
  if (await getLock(store)) throw new Error('a passcode is already set');
  await saveLock(store, passcode, recoveryCode, o);
  await appendLog(store, 'passcode', 'נקבע קוד הורים', new Date(clock(o)()));
}

/**
 * One attempt at a secret, under the shared lockout: refused while locked; a wrong secret counts towards the next
 * lockout (every third: 1, 5, 15, then 60 minutes); the right one clears the count. Logged either way.
 */
async function attempt(
  store: KeyValueStore,
  check: (lock: ParentLock) => Promise<boolean>,
  /** ok: null when the caller logs the success itself. */
  kinds: { ok: 'entry' | 'recovery' | null; failed: 'entry-failed' | 'recovery-failed' },
  texts: { ok: string; failed: string },
  o: LockOptions,
): Promise<AttemptResult> {
  const now = clock(o)();
  const lock = await getLock(store);
  if (!lock) throw new Error('no passcode set');
  const state = await getLockout(store);
  if (lockedFor(state, now) > 0) return { kind: 'locked', until: state.lockedUntil! };
  if (await check(lock)) {
    await store.set(LOCKOUT_KEY, registerSuccess());
    if (kinds.ok) await appendLog(store, kinds.ok, texts.ok, new Date(now));
    return { kind: 'ok' };
  }
  const next = registerFailure(state, now);
  await store.set(LOCKOUT_KEY, next);
  await appendLog(store, kinds.failed, texts.failed, new Date(now));
  if (next.lockedUntil !== null && next.lockedUntil > now) {
    await appendLog(store, 'lockout', `הכניסה ננעלה ל־${minutes(next.lockedUntil - now)} דקות`, new Date(now));
    return { kind: 'locked', until: next.lockedUntil };
  }
  return { kind: 'wrong', left: ATTEMPTS_PER_ROUND - next.failures };
}

export const tryPasscode = (store: KeyValueStore, passcode: string, o: LockOptions = {}) =>
  attempt(
    store,
    (lock) => verifyPasscode(passcode, lock.passcode),
    { ok: 'entry', failed: 'entry-failed' },
    { ok: 'כניסה לאזור ההורים', failed: 'ניסיון כניסה עם קוד שגוי' },
    o,
  );

/** Checks a recovery code (counts towards the same lockout). On success the caller asks for a new passcode. */
export const tryRecoveryCode = (store: KeyValueStore, code: string, o: LockOptions = {}) =>
  attempt(
    store,
    (lock) => verifyRecoveryCode(code, lock.recovery),
    { ok: 'recovery', failed: 'recovery-failed' },
    { ok: 'כניסה עם קוד שחזור', failed: 'ניסיון עם קוד שחזור שגוי' },
    o,
  );

/** Replaces the passcode after the recovery code was accepted (checked again here), with a new recovery code. */
export async function resetWithRecovery(
  store: KeyValueStore,
  code: string,
  passcode: string,
  newRecoveryCode: string,
  o: LockOptions = {},
): Promise<boolean> {
  const lock = await getLock(store);
  if (!lock || !(await verifyRecoveryCode(code, lock.recovery))) return false;
  await saveLock(store, passcode, newRecoveryCode, o, lock.createdAt);
  await appendLog(store, 'passcode', 'קוד ההורים אופס בעזרת קוד השחזור, ונוצר קוד שחזור חדש', new Date(clock(o)()));
  return true;
}

/** Changing the passcode requires the current one (a wrong one counts as a failed attempt). Keeps the recovery code. */
export async function changePasscode(
  store: KeyValueStore,
  current: string,
  next: string,
  o: LockOptions = {},
): Promise<AttemptResult> {
  const result = await attempt(
    store,
    (lock) => verifyPasscode(current, lock.passcode),
    { ok: null, failed: 'entry-failed' },
    { ok: '', failed: 'קוד נוכחי שגוי בניסיון לשנות את הקוד' },
    o,
  );
  if (result.kind !== 'ok') return result;
  const lock = (await getLock(store))!;
  const at = new Date(clock(o)()).toISOString();
  await store.set<ParentLock>(LOCK_KEY, { ...lock, passcode: await hashPasscode(next, o.iterations), changedAt: at });
  await appendLog(store, 'passcode', 'קוד ההורים שונה', new Date(clock(o)()));
  return result;
}
