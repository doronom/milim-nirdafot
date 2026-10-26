import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  GATE_HOLD_SECONDS,
  lockedFor,
  passcodeProblems,
  PROBLEM_TEXT,
  type PasscodeProblem,
} from '../../engine/passcode';
import { getLock, getLockout, tryPasscode, type AttemptResult, type ParentLock as Lock } from '../../state/parent-lock';
import { useStore } from '../../state/store-context';
import { useSync } from '../../sync/sync-context';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { IconButton, TopBar } from '../../ui/TopBar';
import { PasscodeField } from './controls';
import { PairDevice } from './PairDevice';
import styles from './ParentLock.module.css';
import p from './parent.module.css';

type Phase = 'hold' | 'enter' | 'pair' | 'waiting';

/**
 * The parent lock: a 3-second hold (so it never opens by accident), then the passcode. The passcode is set in parent
 * mode on a parent's phone and reaches this device by pairing; it is checked here, offline. A device that was never
 * paired offers only pairing. Wrong attempts lock entry for 1, 5, 15, then 60 minutes.
 */
export function ParentLock({ onOpen }: { onOpen: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pairCode = params.get('pair') ?? '';
  const { paired } = useSync();
  const [lock, setLock] = useState<Lock | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('hold');

  useEffect(() => {
    let cancelled = false;
    void getLock(store).then((l) => !cancelled && setLock(l ?? null));
    return () => {
      cancelled = true;
    };
  }, [store, phase]);

  // A scanned pairing link always leads to pairing; otherwise a device with a passcode asks for it.
  const next = (l: Lock | null): Phase => (pairCode || (!l && !paired) ? 'pair' : l ? 'enter' : 'waiting');

  return (
    <div className={p.area}>
      <TopBar
        start={
          <IconButton label="חזרה למסע" onClick={() => navigate('/')}>
            <Icon name="forward" />
          </IconButton>
        }
        title="בקרת הורים"
      />
      <main className={p.body}>
        <div className={styles.intro}>
          <Pill tone="xp" icon="shield">
            אזור למבוגרים בלבד
          </Pill>
          <h2 className={p.cardTitle}>כניסה לאזור ההורים</h2>
        </div>
        {phase === 'hold' && lock !== undefined && paired !== null && <HoldStep onDone={() => setPhase(next(lock))} />}
        {phase === 'enter' && (
          <EnterPasscode
            onOpen={onOpen}
            footer={
              lock?.source === 'cloud' ? (
                <p className={p.caption}>
                  שכחתם את הקוד? קבעו קוד חדש במצב הורים בטלפון שלכם; הוא יגיע למכשיר הזה בסנכרון הבא.
                </p>
              ) : (
                <button type="button" className={p.linkButton} onClick={() => setPhase('pair')}>
                  חיבור לטלפון של ההורה (מחליף את הקוד שבמכשיר)
                </button>
              )
            }
          />
        )}
        {phase === 'pair' && (
          <>
            {!lock && (
              <div className={p.notice} role="note">
                אזור ההורים נפתח רק במכשיר שחובר לטלפון של ההורה. קוד ההורים נקבע במצב הורים בטלפון שלכם, ומגיע למכשיר
                הזה בחיבור. מכשיר שעוד לא היה מחובר לאינטרנט לא יכול לפתוח את אזור ההורים עד שיחובר.
              </div>
            )}
            <PairDevice initialCode={pairCode} onPaired={() => setPhase('waiting')} />
            {lock && (
              <button type="button" className={p.linkButton} onClick={() => setPhase('enter')}>
                חזרה להקלדת קוד ההורים
              </button>
            )}
          </>
        )}
        {phase === 'waiting' && <WaitingForPasscode onReady={() => setPhase('enter')} />}
        <TactileButton tone="quiet" icon="compass" to="/">
          חזרה למסע של הילד
        </TactileButton>
      </main>
    </div>
  );
}

/** Paired, but the parents have not set a passcode yet (or it has not arrived): check again on demand. */
function WaitingForPasscode({ onReady }: { onReady: () => void }) {
  const store = useStore();
  const { syncNow } = useSync();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getLock(store).then((l) => !cancelled && l && onReady());
    return () => {
      cancelled = true;
    };
  }, [store, onReady]);
  return (
    <Step title="המכשיר מחובר">
      <p className={p.muted}>
        המכשיר מחובר לטלפון של ההורה, אבל עוד לא התקבל קוד הורים. קבעו קוד במצב הורים בטלפון שלכם, ואז לחצו ״בדיקה״.
      </p>
      {message && (
        <p className={p.danger} role="alert">
          {message}
        </p>
      )}
      <TactileButton
        icon="refresh"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await syncNow();
          setBusy(false);
          if (await getLock(store)) return onReady();
          setMessage(result === 'offline' ? 'אין חיבור לאינטרנט.' : 'עוד לא נקבע קוד הורים במצב הורים.');
        }}
      >
        {busy ? 'בודק...' : 'בדיקה'}
      </TactileButton>
    </Step>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={p.card} aria-label={title}>
      <h3 className={p.toggleTitle}>{title}</h3>
      {children}
    </section>
  );
}

/** Hold for 3 seconds; letting go early starts over. */
function HoldStep({ onDone }: { onDone: () => void }) {
  const [held, setHeld] = useState(0);
  const holding = useRef<{ start: number; frame: number } | null>(null);
  const stop = () => {
    if (holding.current) cancelAnimationFrame(holding.current.frame);
    holding.current = null;
    setHeld((h) => (h >= 1 ? 1 : 0));
  };
  const start = () => {
    if (holding.current) return;
    const tick = () => {
      if (!holding.current) return;
      const t = Math.min(1, (performance.now() - holding.current.start) / (GATE_HOLD_SECONDS * 1000));
      setHeld(t);
      if (t >= 1) {
        holding.current = null;
        onDone();
      } else holding.current.frame = requestAnimationFrame(tick);
    };
    holding.current = { start: performance.now(), frame: requestAnimationFrame(tick) };
  };
  useEffect(
    () => () => {
      if (holding.current) cancelAnimationFrame(holding.current.frame);
    },
    [],
  );
  return (
    <Step title={`לחיצה רצופה למשך ${GATE_HOLD_SECONDS} שניות`}>
      <button
        type="button"
        className={styles.hold}
        style={{ ['--local-progress' as string]: held }}
        aria-label={`החזיקו לחוץ ${GATE_HOLD_SECONDS} שניות`}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && start()}
        onKeyUp={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={styles.ring}>
          <span className={styles.ringInner}>{Math.round(held * 100)}%</span>
        </span>
        <span className={p.muted}>החזיקו את האצבע על העיגול</span>
      </button>
    </Step>
  );
}

export function PasscodeRules({ id, passcode }: { id?: string; passcode: string }) {
  const problems = new Set(passcodeProblems(passcode));
  const rules: PasscodeProblem[] = ['too-short', 'repeated', 'sequence'];
  return (
    <ul id={id} className={p.rules} aria-label="דרישות הקוד">
      {rules.map((r) => {
        const met = passcode !== '' && !problems.has(r);
        return (
          <li key={r} className={met ? p.met : undefined}>
            <Icon name={met ? 'check' : 'close'} size="sm" />
            {PROBLEM_TEXT[r]}
          </li>
        );
      })}
    </ul>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const clockText = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

/** Remaining lockout time, read from the store on mount (so it survives a restart) and after each attempt. */
function useLockout(): [number, (until: number | null) => void] {
  const store = useStore();
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    void getLockout(store).then((s) => !cancelled && setUntil(s.lockedUntil));
    return () => {
      cancelled = true;
    };
  }, [store]);
  useEffect(() => {
    if (until === null || until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  // A new lockout starts counting from this moment, not from the last tick.
  const lock = (next: number | null) => {
    setNow(Date.now());
    setUntil(next);
  };
  return [lockedFor({ failures: 0, lockouts: 0, lockedUntil: until }, now), lock];
}

function AttemptMessage({ result, locked }: { result: AttemptResult | null; locked: number }) {
  if (locked > 0)
    return (
      <p className={p.danger} role="alert">
        יותר מדי ניסיונות שגויים. אפשר לנסות שוב בעוד <span dir="ltr">{clockText(locked)}</span> דקות.
      </p>
    );
  if (result?.kind === 'wrong')
    return (
      <p className={p.danger} role="alert">
        קוד שגוי. {result.left === 1 ? 'נותר ניסיון אחד' : `נותרו ${result.left} ניסיונות`} לפני נעילה זמנית.
      </p>
    );
  return null;
}

function EnterPasscode({ onOpen, footer }: { onOpen: () => void; footer: ReactNode }) {
  const store = useStore();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [locked, setUntil] = useLockout();
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!value || locked > 0) return;
    setBusy(true);
    const r = await tryPasscode(store, value);
    setBusy(false);
    setValue('');
    if (r.kind === 'ok') return onOpen();
    setResult(r);
    setUntil(r.kind === 'locked' ? r.until : null);
  };
  return (
    <form className={p.card} aria-label="כניסה עם קוד הורים" onSubmit={send}>
      <h3 className={p.toggleTitle}>הקלידו את קוד ההורים</h3>
      <PasscodeField label="קוד הורים" value={value} onChange={setValue} disabled={busy || locked > 0} autoFocus />
      <AttemptMessage result={result} locked={locked} />
      <TactileButton type="submit" tone="success" icon="lock" disabled={busy || locked > 0 || value === ''}>
        {busy ? 'בודק...' : 'כניסה'}
      </TactileButton>
      {footer}
    </form>
  );
}
