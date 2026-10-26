import type { HashRecord } from '../engine/passcode';
import { getLock, installCloudPasscode } from '../state/parent-lock';
import { appendLog } from '../state/parent-log';
import type { KeyValueStore } from '../storage/kv';
import { FAMILY_ID } from './config';
import { cloud, isOnline, withTimeout } from './firebase';
import { getPairing, setPairing, updateSyncStatus, type LocalPairing } from './local';
import type { ChildSnapshot } from './snapshot';

export type CloudResult = 'ok' | 'offline' | 'denied' | 'error';

const codeOf = (e: unknown) => (e as { code?: string })?.code ?? '';
const classify = (e: unknown): CloudResult => {
  const code = codeOf(e);
  if (code === 'permission-denied' || code === 'not-found') return 'denied';
  if (
    !isOnline() ||
    code === 'unavailable' ||
    code === 'auth/network-request-failed' ||
    (e as Error)?.message === 'timeout'
  )
    return 'offline';
  return 'error';
};

/** The anonymous Firebase user of this device (kept by Firebase Auth across restarts). */
async function deviceUser() {
  const { auth } = await cloud();
  const { signInAnonymously } = await import('firebase/auth');
  await auth.authStateReady();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

/** Reads the parents' passcode hash and installs it if it is newer than the one on the device. */
async function pullPasscode(store: KeyValueStore): Promise<void> {
  const { db } = await cloud();
  const { doc, getDoc } = await import('firebase/firestore');
  const family = await getDoc(doc(db, 'families', FAMILY_ID));
  const data = family.data() as { passcode?: HashRecord; passcodeUpdatedAt?: { toMillis(): number } } | undefined;
  if (data?.passcode && data.passcodeUpdatedAt)
    await installCloudPasscode(store, data.passcode, data.passcodeUpdatedAt.toMillis());
}

/**
 * Pairs this device with the parents using a code from parent mode: in one batch, creates the pairing and marks the
 * code used (the rules allow it only for a fresh, unused code). Then copies the passcode hash to the device.
 */
export async function pairWithCode(store: KeyValueStore, code: string): Promise<CloudResult> {
  if (!isOnline()) return 'offline';
  try {
    return await withTimeout(
      (async () => {
        const user = await deviceUser();
        const { db } = await cloud();
        const { doc, getDoc, deleteDoc, serverTimestamp, writeBatch } = await import('firebase/firestore');
        // Pairing again (for example after the parent unpaired on their side) starts from a clean slate.
        const existing = await getDoc(doc(db, 'pairings', user.uid));
        if (existing.exists()) {
          await deleteDoc(doc(db, 'children', user.uid)).catch(() => undefined);
          await deleteDoc(doc(db, 'pairings', user.uid));
        }
        const batch = writeBatch(db);
        batch.set(doc(db, 'pairings', user.uid), { family: FAMILY_ID, code, pairedAt: serverTimestamp() });
        batch.update(doc(db, 'pairingCodes', code), { used: true, usedBy: user.uid, usedAt: serverTimestamp() });
        await batch.commit();
        const hadLocal = (await getLock(store))?.source === 'local';
        const pairing: LocalPairing = { uid: user.uid, family: FAMILY_ID, pairedAt: new Date().toISOString() };
        await setPairing(store, pairing);
        await appendLog(store, 'change', 'המכשיר חובר לטלפון של ההורה');
        if (hadLocal) await appendLog(store, 'change', 'קוד ההורים המקומי יוחלף בקוד מהטלפון של ההורה');
        await pullPasscode(store);
        await updateSyncStatus(store, { lastPullAt: Date.now() });
        return 'ok' as const;
      })(),
    );
  } catch (e) {
    return classify(e);
  }
}

/**
 * Checks the pairing (a parent may have unpaired the device) and picks up a newer passcode hash. A missing pairing
 * unpairs the device locally; the passcode on the device keeps working.
 */
export async function pullFromCloud(store: KeyValueStore): Promise<CloudResult> {
  const pairing = await getPairing(store);
  if (!pairing || !isOnline()) return pairing ? 'offline' : 'denied';
  try {
    return await withTimeout(
      (async () => {
        const user = await deviceUser();
        const { db } = await cloud();
        const { doc, getDoc } = await import('firebase/firestore');
        const link = user.uid === pairing.uid ? await getDoc(doc(db, 'pairings', user.uid)) : null;
        if (!link?.exists()) {
          await setPairing(store, null);
          await appendLog(store, 'change', 'המכשיר נותק מהטלפון של ההורה');
          return 'denied' as const;
        }
        await pullPasscode(store);
        await updateSyncStatus(store, { lastPullAt: Date.now() });
        return 'ok' as const;
      })(),
    );
  } catch (e) {
    return classify(e);
  }
}

/** Uploads the progress snapshot (this device is the only writer of its profile). */
export async function uploadSnapshot(
  store: KeyValueStore,
  name: string,
  snapshot: ChildSnapshot,
): Promise<CloudResult> {
  const pairing = await getPairing(store);
  if (!pairing) return 'denied';
  if (!isOnline()) return 'offline';
  try {
    return await withTimeout(
      (async () => {
        const { db } = await cloud();
        await deviceUser();
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(db, 'children', pairing.uid), {
          schema: 1,
          name,
          updatedAt: serverTimestamp(),
          appVersion: __APP_VERSION__,
          snapshot,
        });
        await updateSyncStatus(store, { lastUploadAt: Date.now() });
        return 'ok' as const;
      })(),
    );
  } catch (e) {
    const result = classify(e);
    // Denied means the pairing is gone on the server: find out and unpair locally.
    if (result === 'denied') await pullFromCloud(store);
    return result;
  }
}

/**
 * Unpairs from this side: removes the profile and the pairing from the cloud. With `deleteAccount` ("delete cloud
 * data") the device's anonymous account is deleted too. The passcode on the device keeps working.
 */
export async function unpairDevice(store: KeyValueStore, deleteAccount = false): Promise<CloudResult> {
  const pairing = await getPairing(store);
  if (!isOnline()) return 'offline';
  try {
    await withTimeout(
      (async () => {
        const user = await deviceUser();
        const { db } = await cloud();
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'children', user.uid));
        await deleteDoc(doc(db, 'pairings', user.uid));
        if (deleteAccount) await user.delete();
      })(),
    );
    await setPairing(store, null);
    if (pairing || deleteAccount)
      await appendLog(
        store,
        'change',
        deleteAccount ? 'נתוני הענן נמחקו והמכשיר נותק' : 'המכשיר נותק מהטלפון של ההורה',
      );
    return 'ok';
  } catch (e) {
    return classify(e);
  }
}
