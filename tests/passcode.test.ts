import { describe, expect, it } from 'vitest';
import {
  hashPasscode,
  hashRecoveryCode,
  initialLockout,
  lockedFor,
  newRecoveryCode,
  passcodeProblems,
  PBKDF2_ITERATIONS,
  registerFailure,
  registerSuccess,
  verifyPasscode,
  verifyRecoveryCode,
  type LockoutState,
} from '../src/engine/passcode';
import { createBackup, restoreBackup, parseBackup } from '../src/state/backup';
import {
  changePasscode,
  getLock,
  getLockout,
  LOCK_KEY,
  LOCKOUT_KEY,
  resetWithRecovery,
  setupLock,
  tryPasscode,
  tryRecoveryCode,
} from '../src/state/parent-lock';
import { failedSincePreviousEntry, listLog, LOG_KEY } from '../src/state/parent-log';
import { memoryStore } from '../src/storage/kv';

const FAST = 1000; // PBKDF2 iterations for tests; the app uses PBKDF2_ITERATIONS.
const MIN = 60_000;

describe('passcode rules', () => {
  it('needs at least 8 characters of any kind', () => {
    expect(passcodeProblems('Ab3$')).toEqual(['too-short']);
    expect(passcodeProblems('מסע2026!')).toEqual([]);
    expect(passcodeProblems('Tiger&Moon')).toEqual([]);
    expect(passcodeProblems('a b c 9!')).toEqual([]);
  });

  it('rejects one repeated character and simple sequences', () => {
    for (const p of ['11111111', 'aaaaaaaa', 'AAAAaaaa', 'אאאאאאאא']) expect(passcodeProblems(p)).toContain('repeated');
    for (const p of ['12345678', 'abcdefgh', 'ABCDEFGH', '87654321', 'hgfedcba', 'אבגדהוזח', '3456789:'])
      expect(passcodeProblems(p), p).toContain('sequence');
    expect(passcodeProblems('12345679')).toEqual([]);
    expect(passcodeProblems('abcdefgg')).toEqual([]);
  });
});

describe('hashing', () => {
  it('stores a salted PBKDF2-SHA256 hash, never the passcode, at a high cost by default', async () => {
    const record = await hashPasscode('Tiger&Moon');
    expect(record).toMatchObject({ algorithm: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS });
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(JSON.stringify(record)).not.toContain('Tiger');
    expect(atob(record.salt)).toHaveLength(16);
    expect(atob(record.hash)).toHaveLength(32);
    expect(await verifyPasscode('Tiger&Moon', record)).toBe(true);
    expect(await verifyPasscode('tiger&moon', record)).toBe(false);
  });

  it('uses a fresh salt each time', async () => {
    const [a, b] = await Promise.all([hashPasscode('Tiger&Moon', FAST), hashPasscode('Tiger&Moon', FAST)]);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('treats composed and decomposed Hebrew alike', async () => {
    const composed = 'שָׁלוֹם123';
    const record = await hashPasscode(composed, FAST);
    expect(await verifyPasscode(composed.normalize('NFD'), record)).toBe(true);
  });
});

describe('recovery codes', () => {
  it('are random, readable and checked case-insensitively with or without dashes', async () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^([A-HJKMNP-Z2-9]{4}-){4}[A-HJKMNP-Z2-9]{4}$/);
    expect(new Set(Array.from({ length: 20 }, newRecoveryCode)).size).toBe(20);
    const record = await hashRecoveryCode(code, FAST);
    expect(await verifyRecoveryCode(code.toLowerCase().replace(/-/g, ' '), record)).toBe(true);
    expect(await verifyRecoveryCode(newRecoveryCode(), record)).toBe(false);
  });
});

describe('lockout timing', () => {
  const fail = (s: LockoutState, now: number, n: number) => {
    for (let i = 0; i < n; i++) s = registerFailure(s, now);
    return s;
  };

  it('locks after every third wrong attempt for 1, 5, 15, then 60 minutes', () => {
    let s = fail(initialLockout(), 0, 2);
    expect(lockedFor(s, 0)).toBe(0);
    s = fail(s, 0, 1);
    expect(lockedFor(s, 0)).toBe(1 * MIN);
    expect(lockedFor(s, 1 * MIN)).toBe(0);
    let t = 1 * MIN;
    for (const minutes of [5, 15, 60, 60]) {
      s = fail(s, t, 3);
      expect(lockedFor(s, t)).toBe(minutes * MIN);
      t += minutes * MIN;
    }
  });

  it('a success starts over', () => {
    const s = fail(initialLockout(), 0, 5);
    expect(registerSuccess()).toEqual(initialLockout());
    expect(s.lockouts).toBe(1);
  });
});

describe('the lock on the device', () => {
  const setup = async () => {
    const store = memoryStore();
    let now = Date.UTC(2026, 9, 26, 10);
    const o = { iterations: FAST, now: () => now };
    const code = newRecoveryCode();
    await setupLock(store, 'Tiger&Moon', code, o);
    return { store, o, code, tick: (ms: number) => (now += ms) };
  };

  it('keeps hashes only, and lets the right passcode in', async () => {
    const { store, o } = await setup();
    const saved = JSON.stringify(await getLock(store));
    expect(saved).not.toContain('Tiger');
    expect(await tryPasscode(store, 'Tiger&Moon', o)).toEqual({ kind: 'ok' });
  });

  it('locks out after 3 wrong attempts, even across restarts, and refuses the right passcode meanwhile', async () => {
    const { store, o, tick } = await setup();
    expect(await tryPasscode(store, 'nope-nope', o)).toEqual({ kind: 'wrong', left: 2 });
    expect(await tryPasscode(store, 'nope-nope', o)).toEqual({ kind: 'wrong', left: 1 });
    const locked = await tryPasscode(store, 'nope-nope', o);
    expect(locked.kind).toBe('locked');
    // The lockout is in the store, so a fresh app (same store) is still locked.
    expect((await getLockout(store)).lockedUntil).toBe(o.now() + MIN);
    expect((await tryPasscode(store, 'Tiger&Moon', o)).kind).toBe('locked');
    tick(MIN);
    expect(await tryPasscode(store, 'Tiger&Moon', o)).toEqual({ kind: 'ok' });
    const log = await listLog(store);
    expect(log.map((e) => e.kind)).toEqual([
      'passcode',
      'entry-failed',
      'entry-failed',
      'entry-failed',
      'lockout',
      'entry',
    ]);
  });

  it('the recovery code resets the passcode and issues a new code; the old one stops working', async () => {
    const { store, o, code } = await setup();
    expect(await tryRecoveryCode(store, 'AAAA-BBBB-CCCC-DDDD-EEEE', o)).toEqual({ kind: 'wrong', left: 2 });
    expect(await tryRecoveryCode(store, code, o)).toEqual({ kind: 'ok' });
    const next = newRecoveryCode();
    expect(await resetWithRecovery(store, code, 'River#Stone9', next, o)).toBe(true);
    expect(await tryPasscode(store, 'Tiger&Moon', o)).toEqual({ kind: 'wrong', left: 2 });
    expect(await tryPasscode(store, 'River#Stone9', o)).toEqual({ kind: 'ok' });
    expect(await resetWithRecovery(store, code, 'Other#Pass9', newRecoveryCode(), o)).toBe(false);
    expect(await tryRecoveryCode(store, next, o)).toEqual({ kind: 'ok' });
  });

  it('changing the passcode needs the current one', async () => {
    const { store, o } = await setup();
    expect((await changePasscode(store, 'wrong-one', 'River#Stone9', o)).kind).toBe('wrong');
    expect(await changePasscode(store, 'Tiger&Moon', 'River#Stone9', o)).toEqual({ kind: 'ok' });
    expect(await tryPasscode(store, 'River#Stone9', o)).toEqual({ kind: 'ok' });
  });

  it('counts the failed attempts since the previous entry, for the dashboard badge', async () => {
    const { store, o } = await setup();
    await tryPasscode(store, 'Tiger&Moon', o);
    await tryPasscode(store, 'x-wrong-1', o);
    await tryPasscode(store, 'x-wrong-2', o);
    await tryPasscode(store, 'Tiger&Moon', o);
    expect(failedSincePreviousEntry(await listLog(store))).toBe(2);
    await tryPasscode(store, 'Tiger&Moon', o);
    expect(failedSincePreviousEntry(await listLog(store))).toBe(0);
  });

  it('backups never carry the passcode, and importing one keeps this device passcode', async () => {
    const { store, o } = await setup();
    await store.set('progress', { version: 1, levels: {}, settings: {}, xp: 5 });
    const backup = JSON.parse(JSON.stringify(await createBackup(store)));
    const text = JSON.stringify(backup);
    for (const key of [LOCK_KEY, LOCKOUT_KEY, LOG_KEY, 'PBKDF2']) expect(text).not.toContain(key);

    const other = memoryStore();
    await setupLock(other, 'River#Stone9', newRecoveryCode(), o);
    await restoreBackup(other, parseBackup(backup));
    expect(await tryPasscode(other, 'River#Stone9', o)).toEqual({ kind: 'ok' });
    expect(await other.get('progress')).toMatchObject({ xp: 5 });
  });
});
