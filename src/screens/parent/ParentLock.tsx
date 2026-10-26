import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  GATE_HOLD_SECONDS,
  lockedFor,
  newRecoveryCode,
  passcodeProblems,
  PROBLEM_TEXT,
  type PasscodeProblem,
} from '../../engine/passcode';
import {
  getLock,
  getLockout,
  resetWithRecovery,
  setupLock,
  tryPasscode,
  tryRecoveryCode,
  type AttemptResult,
} from '../../state/parent-lock';
import { useStore } from '../../state/store-context';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { IconButton, TopBar } from '../../ui/TopBar';
import { PasscodeField } from './controls';
import styles from './ParentLock.module.css';
import p from './parent.module.css';

type Phase =
  | { kind: 'loading' }
  | { kind: 'hold'; hasLock: boolean }
  | { kind: 'setup' }
  | { kind: 'enter' }
  | { kind: 'recover' }
  | { kind: 'recover-new'; code: string }
  /** The new recovery code, shown once; nothing is saved until the parent confirms writing it down. */
  | { kind: 'show-code'; passcode: string; recoveryCode: string; oldCode?: string };

/**
 * The parent lock: a 3-second hold (so it never opens by accident), then the passcode. On first entry the parent sets
 * a passcode (twice) and gets a one-time recovery code. Wrong attempts lock entry for 1, 5, 15, then 60 minutes.
 */
export function ParentLock({ onOpen }: { onOpen: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getLock(store).then((lock) => !cancelled && setPhase({ kind: 'hold', hasLock: lock !== undefined }));
    return () => {
      cancelled = true;
    };
  }, [store]);

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
        {phase.kind === 'hold' && <HoldStep onDone={() => setPhase({ kind: phase.hasLock ? 'enter' : 'setup' })} />}
        {phase.kind === 'setup' && (
          <NewPasscode
            title="קביעת קוד הורים"
            intro="קוד ההורים שומר על ההגדרות, על התוכן ועל ההתקדמות. בחרו קוד שהילד לא יכול לנחש: לפחות 8 תווים, אותיות בעברית או באנגלית, ספרות וסימנים."
            submit="המשך"
            onDone={(passcode) => setPhase({ kind: 'show-code', passcode, recoveryCode: newRecoveryCode() })}
          />
        )}
        {phase.kind === 'show-code' && (
          <RecoveryCode
            code={phase.recoveryCode}
            onConfirm={async () => {
              if (phase.oldCode) await resetWithRecovery(store, phase.oldCode, phase.passcode, phase.recoveryCode);
              else await setupLock(store, phase.passcode, phase.recoveryCode);
              onOpen();
            }}
          />
        )}
        {phase.kind === 'enter' && <EnterPasscode onOpen={onOpen} onForgot={() => setPhase({ kind: 'recover' })} />}
        {phase.kind === 'recover' && (
          <EnterRecovery
            onBack={() => setPhase({ kind: 'enter' })}
            onAccepted={(code) => setPhase({ kind: 'recover-new', code })}
          />
        )}
        {phase.kind === 'recover-new' && (
          <NewPasscode
            title="קוד הורים חדש"
            intro="קוד השחזור התקבל. קבעו קוד הורים חדש; אחר כך יוצג קוד שחזור חדש, והקודם יפסיק לעבוד."
            submit="המשך"
            onDone={(passcode) =>
              setPhase({ kind: 'show-code', passcode, recoveryCode: newRecoveryCode(), oldCode: phase.code })
            }
          />
        )}
        <TactileButton tone="quiet" icon="compass" to="/">
          חזרה למסע של הילד
        </TactileButton>
      </main>
    </div>
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

/** A new passcode, typed twice, with the rules checked as it is typed. */
function NewPasscode({
  title,
  intro,
  submit,
  onDone,
}: {
  title: string;
  intro: string;
  submit: string;
  onDone: (passcode: string) => void;
}) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);
  const problems = passcodeProblems(first);
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length > 0) return setError(`הקוד צריך: ${problems.map((x) => PROBLEM_TEXT[x]).join('; ')}`);
    if (first !== second) return setError('שני הקודים לא זהים. הקלידו שוב.');
    onDone(first);
  };
  return (
    <form className={p.card} aria-label={title} onSubmit={send}>
      <h3 className={p.toggleTitle}>{title}</h3>
      <p className={p.muted}>{intro}</p>
      <PasscodeField label="קוד הורים" value={first} onChange={setFirst} autoFocus describedBy="passcode-rules" />
      <PasscodeRules id="passcode-rules" passcode={first} />
      <PasscodeField label="שוב, לאישור" value={second} onChange={setSecond} />
      {error && (
        <p className={p.danger} role="alert">
          {error}
        </p>
      )}
      <TactileButton type="submit" tone="success" icon="check">
        {submit}
      </TactileButton>
    </form>
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

/** Shown once: the recovery code, and what happens without it. */
function RecoveryCode({ code, onConfirm }: { code: string; onConfirm: () => Promise<void> }) {
  const [written, setWritten] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className={p.card} aria-label="קוד שחזור">
      <h3 className={p.toggleTitle}>קוד שחזור: רשמו אותו עכשיו</h3>
      <p className={p.muted}>
        אם תשכחו את קוד ההורים, קוד השחזור מאפשר לקבוע קוד חדש. הוא מוצג רק הפעם ולא נשמר במכשיר: נשמר רק גיבוב (hash)
        שלו, שאי אפשר לשחזר ממנו את הקוד. רשמו אותו על נייר או במנהל הסיסמאות שלכם, הרחק מהילד.
      </p>
      <p className={p.code} dir="ltr" aria-label="קוד השחזור">
        {code}
      </p>
      <div className={p.error} role="note">
        <strong>בלי קוד ההורים ובלי קוד השחזור אין דרך חזרה לאזור ההורים.</strong>
        <span>
          האפשרות היחידה תהיה למחוק את נתוני האתר בהגדרות הדפדפן, וזה מוחק גם את כל ההתקדמות של הילד (אלא אם שמרתם קובץ
          גיבוי).
        </span>
      </div>
      <label className={p.check}>
        <input type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} />
        <span>רשמתי את קוד השחזור במקום בטוח</span>
      </label>
      <TactileButton
        tone="success"
        icon="lock"
        disabled={!written || busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
        }}
      >
        {busy ? 'שומר...' : 'סיום וכניסה'}
      </TactileButton>
    </section>
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

function EnterPasscode({ onOpen, onForgot }: { onOpen: () => void; onForgot: () => void }) {
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
      <button type="button" className={p.linkButton} onClick={onForgot}>
        שכחתי את הקוד
      </button>
    </form>
  );
}

function EnterRecovery({ onBack, onAccepted }: { onBack: () => void; onAccepted: (code: string) => void }) {
  const store = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [locked, setUntil] = useLockout();
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || locked > 0) return;
    setBusy(true);
    const r = await tryRecoveryCode(store, code);
    setBusy(false);
    if (r.kind === 'ok') return onAccepted(code);
    setResult(r);
    setUntil(r.kind === 'locked' ? r.until : null);
  };
  return (
    <form className={p.card} aria-label="כניסה עם קוד השחזור" onSubmit={send}>
      <h3 className={p.toggleTitle}>כניסה עם קוד השחזור</h3>
      <p className={p.muted}>הקלידו את קוד השחזור שרשמתם כשקבעתם את קוד ההורים (אותיות וספרות, עם מקפים או בלי).</p>
      <label className={p.field}>
        <span>קוד שחזור</span>
        <input
          className={p.input}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          disabled={locked > 0}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
        />
      </label>
      <AttemptMessage result={result} locked={locked} />
      <TactileButton type="submit" icon="key" disabled={busy || locked > 0 || code.trim() === ''}>
        {busy ? 'בודק...' : 'אימות קוד השחזור'}
      </TactileButton>
      <button type="button" className={p.linkButton} onClick={onBack}>
        חזרה להקלדת קוד ההורים
      </button>
    </form>
  );
}
