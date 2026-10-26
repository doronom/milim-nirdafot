import type { User } from 'firebase/auth';
import { hashPasscode } from '../engine/passcode';
import { FAMILY_ID, USE_EMULATORS } from './config';
import { cloud } from './firebase';
import { newPairingCode } from './local';
import type { ChildSnapshot } from './snapshot';

/** Parent mode: Google sign-in for the allowlisted parents, who see their children and manage pairing and the passcode. */

export async function currentParent(): Promise<User | null> {
  const { auth } = await cloud();
  const { getRedirectResult } = await import('firebase/auth');
  await getRedirectResult(auth).catch(() => null);
  await auth.authStateReady();
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user : null;
}

/** Google sign-in: a popup, or a full-page redirect where popups are blocked (some installed apps). */
export async function signInParent(): Promise<User | null> {
  const { auth } = await cloud();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw e;
  }
}

export async function signOutParent(): Promise<void> {
  const { auth } = await cloud();
  await auth.signOut();
}

/**
 * Whether the signed-in account is on the allowlist. The allowlist itself is unreadable from any client, so this asks
 * Firestore for something only allowlisted parents may read and treats a refusal as "not authorized".
 */
export async function isAuthorized(): Promise<boolean> {
  const { db } = await cloud();
  const { doc, getDoc } = await import('firebase/firestore');
  try {
    await getDoc(doc(db, 'families', FAMILY_ID));
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return false;
    throw e;
  }
}

export interface FamilyInfo {
  passcodeSet: boolean;
  passcodeUpdatedAt?: number;
}

export async function getFamily(): Promise<FamilyInfo> {
  const { db } = await cloud();
  const { doc, getDoc } = await import('firebase/firestore');
  const data = (await getDoc(doc(db, 'families', FAMILY_ID))).data() as
    { passcode?: unknown; passcodeUpdatedAt?: { toMillis(): number } } | undefined;
  return { passcodeSet: Boolean(data?.passcode), passcodeUpdatedAt: data?.passcodeUpdatedAt?.toMillis() };
}

/**
 * Sets the family passcode: hashed here (salted PBKDF2, 600,000 iterations); only the hash leaves the phone. Paired
 * devices pick it up on their next sync, and it replaces the previous one there (this is also how a forgotten passcode
 * is reset).
 */
export async function setFamilyPasscode(passcode: string): Promise<void> {
  const { db, auth } = await cloud();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const record = await hashPasscode(passcode);
  await setDoc(doc(db, 'families', FAMILY_ID), {
    passcode: record,
    passcodeUpdatedAt: serverTimestamp(),
    passcodeUpdatedBy: auth.currentUser!.uid,
  });
}

/** A fresh single-use pairing code, valid for 10 minutes (the rules check both). */
export async function createPairingCode(): Promise<string> {
  const { db, auth } = await cloud();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  for (let attempt = 0; ; attempt++) {
    const code = newPairingCode();
    try {
      await setDoc(doc(db, 'pairingCodes', code), {
        family: FAMILY_ID,
        createdBy: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
        used: false,
      });
      return code;
    } catch (e) {
      // A taken code reads as an update and is refused: try another.
      if (attempt >= 3 || (e as { code?: string }).code !== 'permission-denied') throw e;
    }
  }
}

/** Calls back once the code has been used by a child device. */
export async function watchPairingCode(code: string, onUsed: () => void): Promise<() => void> {
  const { db } = await cloud();
  const { doc, onSnapshot } = await import('firebase/firestore');
  return onSnapshot(
    doc(db, 'pairingCodes', code),
    (snap) => snap.data()?.used && onUsed(),
    () => undefined,
  );
}

export async function deletePairingCode(code: string): Promise<void> {
  const { db } = await cloud();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'pairingCodes', code)).catch(() => undefined);
}

export interface ChildProfile {
  uid: string;
  pairedAt?: number;
  name?: string;
  /** Last upload from the child's device (epoch ms). */
  updatedAt?: number;
  snapshot?: ChildSnapshot;
}

/** The family's paired children, live: called again whenever a child pairs, unpairs or uploads. */
export async function watchChildren(onChange: (children: ChildProfile[]) => void): Promise<() => void> {
  const { db } = await cloud();
  const { collection, doc, onSnapshot, query, where } = await import('firebase/firestore');
  const profiles = new Map<string, ChildProfile>();
  const unsubscribeChild = new Map<string, () => void>();
  let pairedAt = new Map<string, number | undefined>();
  const emit = () =>
    onChange([...pairedAt.keys()].map((uid) => ({ uid, pairedAt: pairedAt.get(uid), ...profiles.get(uid) })));
  const stopPairings = onSnapshot(
    query(collection(db, 'pairings'), where('family', '==', FAMILY_ID)),
    (snap) => {
      pairedAt = new Map(
        snap.docs.map((d) => [d.id, (d.data().pairedAt as { toMillis(): number } | null)?.toMillis()]),
      );
      for (const [uid, stop] of unsubscribeChild)
        if (!pairedAt.has(uid)) {
          stop();
          unsubscribeChild.delete(uid);
          profiles.delete(uid);
        }
      for (const uid of pairedAt.keys())
        if (!unsubscribeChild.has(uid))
          unsubscribeChild.set(
            uid,
            onSnapshot(
              doc(db, 'children', uid),
              (c) => {
                const data = c.data() as
                  { name?: string; updatedAt?: { toMillis(): number }; snapshot?: ChildSnapshot } | undefined;
                profiles.set(uid, {
                  uid,
                  name: data?.name,
                  updatedAt: data?.updatedAt?.toMillis(),
                  snapshot: data?.snapshot,
                });
                emit();
              },
              () => undefined,
            ),
          );
      emit();
    },
    () => undefined,
  );
  return () => {
    stopPairings();
    unsubscribeChild.forEach((stop) => stop());
  };
}

/** Unpairs a child from the parent side; "delete cloud data" also removes the profile (both delete it here). */
export async function removeChild(uid: string): Promise<void> {
  const { db } = await cloud();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'children', uid));
  await deleteDoc(doc(db, 'pairings', uid));
}

/**
 * e2e only (emulator builds): signs in as a fake Google account. The Auth emulator accepts an unsigned ID token; the
 * production build drops this code entirely.
 */
export async function signInTestParent(email: string): Promise<void> {
  if (!USE_EMULATORS) throw new Error('test sign-in is for emulator builds only');
  const { auth } = await cloud();
  const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
  const token = JSON.stringify({ sub: email, email, email_verified: true });
  await signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
