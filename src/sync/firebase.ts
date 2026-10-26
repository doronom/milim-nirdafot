import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { APP_CHECK_SITE_KEY, EMULATOR_PROJECT_ID, firebaseConfig, USE_EMULATORS } from './config';

export interface Cloud {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let loading: Promise<Cloud> | null = null;

/**
 * Loads Firebase on first use (a separate chunk, so the game itself never waits for it or needs it). App Check runs
 * when a site key is configured; e2e builds use the local emulators.
 */
export function cloud(): Promise<Cloud> {
  loading ??= (async () => {
    const [{ initializeApp }, { getAuth, connectAuthEmulator }, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(USE_EMULATORS ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig);
    if (APP_CHECK_SITE_KEY && !USE_EMULATORS) {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }
    const auth = getAuth(app);
    // Snapshots are uploaded explicitly; no Firestore cache is kept on the device.
    const db = fs.initializeFirestore(app, { localCache: fs.memoryLocalCache() });
    if (USE_EMULATORS) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    return { app, auth, db };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Rejects after `ms`, so a hanging network never holds the game. */
export function withTimeout<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

export const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;
