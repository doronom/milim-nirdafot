import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { USE_EMULATORS } from '../../sync/config';
import { setParentDevice } from '../../sync/device-mode';
import { cloud } from '../../sync/firebase';
import {
  isAuthorized,
  signInParent,
  signInTestParent,
  signOutParent,
  watchChildren,
  type ChildProfile,
} from '../../sync/parent';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { IconButton, TopBar } from '../../ui/TopBar';
import styles from '../parent/parent.module.css';

export interface ParentModeContext {
  user: User;
  children: ChildProfile[] | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out'; error?: string }
  | { kind: 'checking'; user: User }
  | { kind: 'not-authorized'; user: User }
  | { kind: 'ready'; user: User }
  | { kind: 'offline' };

/**
 * Parent mode, for a parent's own phone: Google sign-in (only allowlisted accounts get in), then the paired children's
 * progress from the cloud, pairing codes and the family passcode. Separate from the child's game and its passcode.
 */
export function ParentMode() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [children, setChildren] = useState<ChildProfile[] | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { auth } = await cloud();
        const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth');
        await getRedirectResult(auth).catch(() => null);
        stop = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          if (!user || user.isAnonymous) return setState({ kind: 'signed-out' });
          setState({ kind: 'checking', user });
          try {
            const ok = await isAuthorized();
            if (cancelled) return;
            setState({ kind: ok ? 'ready' : 'not-authorized', user });
            if (ok) setParentDevice(true);
          } catch {
            if (!cancelled) setState({ kind: 'offline' });
          }
        });
      } catch {
        if (!cancelled) setState({ kind: 'offline' });
      }
    })();
    if (USE_EMULATORS) (window as unknown as { __wqTestSignIn?: unknown }).__wqTestSignIn = signInTestParent;
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void watchChildren((list) => !cancelled && setChildren(list)).then((s) => (cancelled ? s() : (stop = s)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [state.kind]);

  const signOut = async () => {
    await signOutParent();
    setParentDevice(false);
    setChildren(null);
  };

  if (state.kind === 'ready') return <Outlet context={{ user: state.user, children } satisfies ParentModeContext} />;

  return (
    <div className={styles.area}>
      <TopBar
        start={
          <IconButton label="למשחק" onClick={() => navigate('/')}>
            <Icon name="forward" />
          </IconButton>
        }
        title="מצב הורים"
      />
      <main className={styles.body}>
        <Pill tone="xp" icon="shield">
          לטלפון של ההורה
        </Pill>
        {state.kind === 'loading' || state.kind === 'checking' ? (
          <p className={styles.muted}>רגע...</p>
        ) : state.kind === 'offline' ? (
          <p className={styles.notice} role="alert">
            מצב הורים צריך חיבור לאינטרנט. המשחק עצמו עובד גם בלי.
          </p>
        ) : state.kind === 'not-authorized' ? (
          <section className={styles.card} role="alert" aria-label="אין הרשאה">
            <h2 className={styles.cardTitle}>החשבון הזה לא מורשה</h2>
            <p className={styles.muted}>
              {state.user.email} אינו אחד מחשבונות ההורים של המשחק, ולכן אין לו גישה למצב הורים. אפשר לצאת ולהיכנס עם
              חשבון אחר.
            </p>
            <TactileButton tone="quiet" icon="back" onClick={() => void signOut()}>
              יציאה מהחשבון
            </TactileButton>
          </section>
        ) : (
          <section className={styles.card} aria-label="כניסה למצב הורים">
            <h2 className={styles.cardTitle}>כניסה למצב הורים</h2>
            <p className={styles.muted}>
              כאן רואים את ההתקדמות של הילדים מהטלפון שלכם, מחברים מכשירים וקובעים את קוד ההורים. הכניסה בחשבון Google
              של אחד ההורים המורשים בלבד.
            </p>
            {state.error && (
              <p className={styles.danger} role="alert">
                {state.error}
              </p>
            )}
            <TactileButton
              icon="user"
              onClick={async () => {
                try {
                  await signInParent();
                } catch {
                  setState({ kind: 'signed-out', error: 'הכניסה לא הצליחה. נסו שוב.' });
                }
              }}
            >
              כניסה עם Google
            </TactileButton>
          </section>
        )}
      </main>
    </div>
  );
}
