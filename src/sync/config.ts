/**
 * Firebase web config. It is public by design: it only names the project. Access is decided by the Firestore
 * Security Rules (firestore.rules) and App Check, not by keeping these values secret.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAuYcCvj93onyUb5o0CQW8ES0ZkO1r4Aww',
  authDomain: 'word-quest-512809.firebaseapp.com',
  projectId: 'word-quest-512809',
  storageBucket: 'word-quest-512809.firebasestorage.app',
  messagingSenderId: '172485408614',
  appId: '1:172485408614:web:2c0138ad7e6a8ed0d57aa7',
};

/** reCAPTCHA Enterprise site key for App Check (public). App Check is off while it is empty. */
export const APP_CHECK_SITE_KEY = '';

/** The one family of allowlisted parents; children pair to it. */
export const FAMILY_ID = 'main';

/** Builds for the e2e tests talk to the local Auth and Firestore emulators instead of the real project. */
export const USE_EMULATORS = import.meta.env.VITE_FIREBASE_EMULATOR === 'true';
export const EMULATOR_PROJECT_ID = 'demo-word-quest';
