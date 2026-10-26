import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Placeholder accounts only: the real allowlist lives in Firestore, never in the repository.
const PARENT_A = 'parent-a@example.com';
const PARENT_B = 'parent-b@example.com';
const STRANGER = 'stranger@example.com';
const FAMILY = 'main';
const HASH = {
  algorithm: 'PBKDF2-SHA256',
  iterations: 600_000,
  salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
  hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
};

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-word-quest-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config/parents'), { emails: [PARENT_A, PARENT_B] });
  });
});

const google = (uid: string, email: string, verified = true): RulesTestContext =>
  env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: 'google.com' } });
const child = (uid: string): RulesTestContext =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } });
const parentA = () => google('parent-a', PARENT_A);
const parentB = () => google('parent-b', PARENT_B);
const stranger = () => google('stranger', STRANGER);

/** A pairing code as a parent creates it (optionally aged, as if created minutes ago). */
async function seedCode(code: string, minutesAgo = 0, used = false) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pairingCodes', code), {
      family: FAMILY,
      createdBy: 'parent-a',
      createdAt: Timestamp.fromMillis(Date.now() - minutesAgo * 60_000),
      used,
    });
  });
}

/** The child's side of pairing: create its pairing and mark the code used, in one batch. */
function redeem(ctx: RulesTestContext, uid: string, code: string) {
  const db = ctx.firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'pairings', uid), { family: FAMILY, code, pairedAt: serverTimestamp() });
  batch.update(doc(db, 'pairingCodes', code), { used: true, usedBy: uid, usedAt: serverTimestamp() });
  return batch.commit();
}

async function seedPaired(uid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pairings', uid), {
      family: FAMILY,
      code: 'SEEDED22',
      pairedAt: Timestamp.now(),
    });
    await setDoc(doc(ctx.firestore(), 'children', uid), {
      schema: 1,
      name: 'נועה',
      updatedAt: Timestamp.now(),
      snapshot: { xp: 5 },
    });
  });
}

const profile = (name = 'נועה') => ({
  schema: 1,
  name,
  updatedAt: serverTimestamp(),
  appVersion: 'test',
  snapshot: { xp: 10 },
});

describe('allowlist', () => {
  it('nobody can read or write the allowlist from a client', async () => {
    for (const ctx of [parentA(), stranger(), child('c1'), env.unauthenticatedContext()]) {
      await assertFails(getDoc(doc(ctx.firestore(), 'config/parents')));
      await assertFails(setDoc(doc(ctx.firestore(), 'config/parents'), { emails: [STRANGER] }));
    }
  });

  it('a Google account that is not on the allowlist is rejected everywhere a parent may go', async () => {
    await seedPaired('c1');
    const db = stranger().firestore();
    await assertFails(getDoc(doc(db, 'children/c1')));
    await assertFails(getDocs(query(collection(db, 'pairings'), where('family', '==', FAMILY))));
    await assertFails(
      setDoc(doc(db, 'pairingCodes/ABCDEFGH'), {
        family: FAMILY,
        createdBy: 'stranger',
        createdAt: serverTimestamp(),
        used: false,
      }),
    );
    await assertFails(
      setDoc(doc(db, `families/${FAMILY}`), {
        passcode: HASH,
        passcodeUpdatedAt: serverTimestamp(),
        passcodeUpdatedBy: 'stranger',
      }),
    );
    await assertFails(getDoc(doc(db, `families/${FAMILY}`)));
  });

  it('an allowlisted address whose email is not verified, or not from Google, is rejected', async () => {
    await seedPaired('c1');
    await assertFails(getDoc(doc(google('x', PARENT_A, false).firestore(), 'children/c1')));
    const password = env.authenticatedContext('y', {
      email: PARENT_A,
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });
    await assertFails(getDoc(doc(password.firestore(), 'children/c1')));
  });

  it('allowlisted parents can read paired profiles, list pairings and make codes; the address is case-insensitive', async () => {
    await seedPaired('c1');
    const db = parentB().firestore();
    await assertSucceeds(getDoc(doc(db, 'children/c1')));
    await assertSucceeds(getDocs(query(collection(db, 'pairings'), where('family', '==', FAMILY))));
    const upper = google('parent-a', PARENT_A.toUpperCase()).firestore();
    await assertSucceeds(
      setDoc(doc(upper, 'pairingCodes/ABCDEFGH'), {
        family: FAMILY,
        createdBy: 'parent-a',
        createdAt: serverTimestamp(),
        used: false,
      }),
    );
  });

  it('there are no public reads', async () => {
    await seedPaired('c1');
    const db = env.unauthenticatedContext().firestore();
    for (const path of ['children/c1', 'pairings/c1', `families/${FAMILY}`, 'pairingCodes/SEEDED22'])
      await assertFails(getDoc(doc(db, path)));
  });
});

describe('passcode hash', () => {
  it('only parents set it, only as a strong hash record, and only paired children read it', async () => {
    const write = (ctx: RulesTestContext, uid: string, passcode: unknown) =>
      setDoc(doc(ctx.firestore(), `families/${FAMILY}`), {
        passcode,
        passcodeUpdatedAt: serverTimestamp(),
        passcodeUpdatedBy: uid,
      });
    await assertSucceeds(write(parentA(), 'parent-a', HASH));
    await assertFails(write(parentA(), 'parent-a', { ...HASH, iterations: 1000 }));
    await assertFails(write(parentA(), 'parent-a', 'Tiger&Moon7'));
    await assertFails(write(parentA(), 'someone-else', HASH));
    await assertFails(write(child('c1'), 'c1', HASH));

    await assertFails(getDoc(doc(child('c1').firestore(), `families/${FAMILY}`)));
    await seedPaired('c1');
    await assertSucceeds(getDoc(doc(child('c1').firestore(), `families/${FAMILY}`)));
    await assertSucceeds(getDoc(doc(parentB().firestore(), `families/${FAMILY}`)));
  });
});

describe('pairing codes', () => {
  it('a parent creates a valid 8-character code that only they can read back', async () => {
    const create = (code: string, data: Record<string, unknown> = {}) =>
      setDoc(doc(parentA().firestore(), 'pairingCodes', code), {
        family: FAMILY,
        createdBy: 'parent-a',
        createdAt: serverTimestamp(),
        used: false,
        ...data,
      });
    await assertSucceeds(create('K7QM2XRA'));
    await assertFails(create('short'));
    await assertFails(create('K7QM2XR0')); // 0 is not in the alphabet
    await assertFails(create('K7QM2XRB', { used: true }));
    await assertFails(create('K7QM2XRC', { createdAt: Timestamp.fromMillis(Date.now() + 3_600_000) }));
    await assertSucceeds(getDoc(doc(parentA().firestore(), 'pairingCodes/K7QM2XRA')));
    await assertFails(getDoc(doc(parentB().firestore(), 'pairingCodes/K7QM2XRA')));
    await assertFails(getDoc(doc(child('c1').firestore(), 'pairingCodes/K7QM2XRA')));
    await assertFails(getDocs(collection(child('c1').firestore(), 'pairingCodes')));
  });

  it('a child redeems a fresh code once, which pairs it', async () => {
    await seedCode('K7QM2XRA');
    await assertSucceeds(redeem(child('c1'), 'c1', 'K7QM2XRA'));
    await assertSucceeds(getDoc(doc(child('c1').firestore(), 'pairings/c1')));
  });

  it('a used code fails, also for another child', async () => {
    await seedCode('K7QM2XRA');
    await assertSucceeds(redeem(child('c1'), 'c1', 'K7QM2XRA'));
    await assertFails(redeem(child('c2'), 'c2', 'K7QM2XRA'));
    await seedCode('USED2222', 0, true);
    await assertFails(redeem(child('c3'), 'c3', 'USED2222'));
  });

  it('an expired code (older than 10 minutes) fails', async () => {
    await seedCode('OLDCODE2'.replace('O', 'Q'), 11);
    await assertFails(redeem(child('c1'), 'c1', 'QLDCODE2'));
    await seedCode('NEWCODE2', 9);
    await assertSucceeds(redeem(child('c1'), 'c1', 'NEWCODE2'));
  });

  it('a code that does not exist fails, and pairing cannot skip the code or claim it for someone else', async () => {
    await assertFails(redeem(child('c1'), 'c1', 'NOSUCH22'));
    await seedCode('K7QM2XRA');
    const db = child('c1').firestore();
    await assertFails(
      setDoc(doc(db, 'pairings/c1'), { family: FAMILY, code: 'K7QM2XRA', pairedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db, 'pairingCodes/K7QM2XRA'), { used: true, usedBy: 'c1', usedAt: serverTimestamp() }),
    );
    await assertFails(redeem(child('c1'), 'c2', 'K7QM2XRA'));
    await assertFails(redeem(parentA(), 'parent-a', 'K7QM2XRA'));
  });
});

describe('child profiles', () => {
  it('a child writes only its own profile, and only while paired', async () => {
    const db = child('c1').firestore();
    await assertFails(setDoc(doc(db, 'children/c1'), profile()));
    await seedPaired('c1');
    await assertSucceeds(setDoc(doc(db, 'children/c1'), profile()));
    await assertFails(setDoc(doc(db, 'children/c1'), { ...profile(), email: 'x@example.com' }));
    await assertFails(setDoc(doc(db, 'children/c1'), { ...profile(), updatedAt: Timestamp.fromMillis(0) }));
    await seedPaired('c2');
    await assertFails(setDoc(doc(db, 'children/c2'), profile()));
  });

  it('a child cannot read another child profile, pairing or anything else', async () => {
    await seedPaired('c1');
    await seedPaired('c2');
    const db = child('c1').firestore();
    await assertSucceeds(getDoc(doc(db, 'children/c1')));
    await assertFails(getDoc(doc(db, 'children/c2')));
    await assertFails(getDoc(doc(db, 'pairings/c2')));
    await assertFails(getDocs(query(collection(db, 'pairings'), where('family', '==', FAMILY))));
    await assertFails(getDocs(collection(db, 'children')));
  });

  it('parents cannot write a child profile, and cannot read an unpaired one', async () => {
    await seedPaired('c1');
    await assertFails(setDoc(doc(parentA().firestore(), 'children/c1'), profile()));
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'children/c9'), { schema: 1, name: 'x', snapshot: {} }),
    );
    await assertFails(getDoc(doc(parentA().firestore(), 'children/c9')));
  });

  it('unpairing and deleting cloud data work from both sides; a pairing cannot be edited', async () => {
    await seedPaired('c1');
    await assertFails(updateDoc(doc(child('c1').firestore(), 'pairings/c1'), { family: 'other' }));
    await assertSucceeds(deleteDoc(doc(child('c1').firestore(), 'children/c1')));
    await assertSucceeds(deleteDoc(doc(child('c1').firestore(), 'pairings/c1')));
    await seedPaired('c2');
    await assertSucceeds(deleteDoc(doc(parentA().firestore(), 'pairings/c2')));
    await assertSucceeds(deleteDoc(doc(parentA().firestore(), 'children/c2')));
    await seedPaired('c3');
    await assertFails(deleteDoc(doc(stranger().firestore(), 'children/c3')));
    await assertFails(deleteDoc(doc(child('c1').firestore(), 'children/c3')));
  });

  it('phase-2 commands stay closed', async () => {
    await seedPaired('c1');
    await assertFails(setDoc(doc(parentA().firestore(), 'children/c1/commands/x'), { type: 'approve' }));
    await assertFails(getDocs(collection(child('c1').firestore(), 'children/c1/commands')));
  });
});
