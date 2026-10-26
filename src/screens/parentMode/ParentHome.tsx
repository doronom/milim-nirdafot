import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { passcodeProblems, PROBLEM_TEXT } from '../../engine/passcode';
import { setParentDevice } from '../../sync/device-mode';
import { formatPairingCode, PAIRING_MINUTES } from '../../sync/local';
import {
  createPairingCode,
  deletePairingCode,
  getFamily,
  removeChild,
  setFamilyPasscode,
  signOutParent,
  watchPairingCode,
  type ChildProfile,
  type FamilyInfo,
} from '../../sync/parent';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { IconButton, TopBar } from '../../ui/TopBar';
import { PasscodeField } from '../parent/controls';
import { PasscodeRules } from '../parent/ParentLock';
import styles from '../parent/parent.module.css';
import type { ParentModeContext } from './ParentMode';

const when = new Intl.DateTimeFormat('he', { dateStyle: 'short', timeStyle: 'short' });

/** Parent mode's home: the paired children, connecting a device, and the family passcode. */
export function ParentHome() {
  const { user, children } = useOutletContext<ParentModeContext>();
  const navigate = useNavigate();
  return (
    <div className={styles.area}>
      <TopBar
        start={
          <IconButton label="למשחק" onClick={() => navigate('/')}>
            <Icon name="forward" />
          </IconButton>
        }
        title="מצב הורים"
        subtitle={user.email ?? undefined}
        end={
          <button
            type="button"
            className={styles.linkButton}
            onClick={async () => {
              await signOutParent();
              setParentDevice(false);
            }}
          >
            יציאה
          </button>
        }
      />
      <main className={styles.body}>
        <Children list={children} />
        <PairingCode />
        <FamilyPasscode />
        <p className={styles.caption}>
          בענן נשמרים רק השם הפרטי של הילד ונתוני ההתקדמות (בלי הקלטות). ״ניתוק״ מוחק את הפרופיל מהענן.
        </p>
      </main>
    </div>
  );
}

function Children({ list }: { list: ChildProfile[] | null }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <section className={styles.card} aria-labelledby="pm-children">
      <div className={styles.cardHead}>
        <h2 id="pm-children" className={styles.cardTitle}>
          <Icon name="user" /> הילדים
        </h2>
        <Pill tone="world">{list?.length ?? 0}</Pill>
      </div>
      {list === null ? (
        <p className={styles.muted}>טוען...</p>
      ) : list.length === 0 ? (
        <p className={styles.muted}>עוד אין מכשיר מחובר. צרו קוד חיבור למטה והזינו אותו באזור ההורים במכשיר של הילד.</p>
      ) : (
        <ul className={styles.list}>
          {list.map((c) => {
            const worlds = c.snapshot?.worlds ?? [];
            const done = worlds.reduce((s, w) => s + w.levelsDone, 0);
            return (
              <li key={c.uid} className={styles.item} aria-label={c.name || 'ילד'}>
                <div className={styles.itemHead}>
                  <span className={styles.word}>{c.name || 'בלי שם'}</span>
                  {c.snapshot && <Pill tone="xp">{c.snapshot.progress.xp} XP</Pill>}
                  {c.snapshot && <Pill>{done} שלבים</Pill>}
                </div>
                <span className={styles.caption}>
                  סנכרון אחרון: {c.updatedAt ? when.format(new Date(c.updatedAt)) : 'עוד לא'}
                </span>
                {confirm === c.uid ? (
                  <div className={styles.error} role="alert">
                    <span>לנתק את המכשיר ולמחוק את הפרופיל מהענן? ההתקדמות במכשיר עצמו נשארת.</span>
                    <div className={styles.actions}>
                      <TactileButton
                        tone="danger"
                        onClick={async () => {
                          await removeChild(c.uid);
                          setConfirm(null);
                        }}
                      >
                        כן, לנתק ולמחוק
                      </TactileButton>
                      <TactileButton tone="quiet" onClick={() => setConfirm(null)}>
                        ביטול
                      </TactileButton>
                    </div>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    {c.snapshot && (
                      <Link className={styles.linkButton} to={`child/${c.uid}`}>
                        <Icon name="chart" size="sm" /> לוח בקרה
                      </Link>
                    )}
                    <button type="button" className={styles.linkButton} onClick={() => setConfirm(c.uid)}>
                      <Icon name="trash" size="sm" /> ניתוק ומחיקת נתוני הענן
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A pairing code with its QR, valid for 10 minutes and once; it reports when the child's device used it. */
function PairingCode() {
  const [code, setCode] = useState<{ code: string; until: number; qr: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [used, setUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = code ? Math.max(0, code.until - now) : 0;

  useEffect(() => {
    if (!code) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void watchPairingCode(code.code, () => setUsed(true)).then((s) => (cancelled ? s() : (stop = s)));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      stop?.();
      window.clearInterval(timer);
    };
  }, [code]);

  const create = async () => {
    setError(null);
    setUsed(false);
    try {
      const c = await createPairingCode();
      // The QR opens the game's pairing screen with the code filled in (or is read by the in-app scanner).
      const link = `${location.origin}${location.pathname}#/parent?pair=${c}`;
      const { toDataURL } = await import('qrcode');
      const qr = await toDataURL(link, { margin: 2, width: 512, errorCorrectionLevel: 'M' });
      setNow(Date.now());
      setCode({ code: c, until: Date.now() + PAIRING_MINUTES * 60_000, qr });
    } catch {
      setError('לא הצלחנו ליצור קוד. בדקו את החיבור ונסו שוב.');
    }
  };

  return (
    <section className={styles.card} aria-labelledby="pm-pair">
      <h2 id="pm-pair" className={styles.cardTitle}>
        <Icon name="key" /> חיבור מכשיר של ילד
      </h2>
      {!code ? (
        <>
          <p className={styles.muted}>
            צרו קוד, ואז במכשיר של הילד: אזור ההורים, לחיצה ארוכה, וסריקת הקוד או הקלדתו. החיבור מעביר למכשיר את קוד
            ההורים.
          </p>
          <TactileButton icon="plus" onClick={() => void create()}>
            יצירת קוד חיבור
          </TactileButton>
        </>
      ) : used ? (
        <p className={styles.ok} role="status">
          המכשיר חובר! ההתקדמות שלו תופיע ברשימת הילדים אחרי הסנכרון הראשון.
        </p>
      ) : left > 0 ? (
        <>
          <img className={styles.qr} src={code.qr} alt={`קוד QR לחיבור, קוד ${formatPairingCode(code.code)}`} />
          <p className={styles.code} dir="ltr" aria-label="קוד החיבור">
            {formatPairingCode(code.code)}
          </p>
          <p className={styles.caption}>
            בתוקף עוד{' '}
            <span dir="ltr">{`${pad(Math.floor(left / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`}</span>,
            לשימוש אחד.
          </p>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              void deletePairingCode(code.code);
              setCode(null);
            }}
          >
            ביטול הקוד
          </button>
        </>
      ) : (
        <>
          <p className={styles.muted}>פג תוקף הקוד.</p>
          <TactileButton icon="refresh" onClick={() => void create()}>
            קוד חדש
          </TactileButton>
        </>
      )}
      {used && (
        <button type="button" className={styles.linkButton} onClick={() => setCode(null)}>
          חיבור מכשיר נוסף
        </button>
      )}
      {error && (
        <p className={styles.danger} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Sets the family passcode (hashed on this phone). It reaches paired devices on their next sync. */
function FamilyPasscode() {
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getFamily()
      .then((f) => !cancelled && setFamily(f))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problems = passcodeProblems(first);
    if (problems.length > 0)
      return setMessage({ ok: false, text: `הקוד צריך: ${problems.map((x) => PROBLEM_TEXT[x]).join('; ')}` });
    if (first !== second) return setMessage({ ok: false, text: 'שני הקודים לא זהים. הקלידו שוב.' });
    setBusy(true);
    try {
      await setFamilyPasscode(first);
      setFirst('');
      setSecond('');
      setFamily(await getFamily());
      setMessage({ ok: true, text: 'קוד ההורים נשמר. המכשירים המחוברים יקבלו אותו בסנכרון הבא.' });
    } catch {
      setMessage({ ok: false, text: 'השמירה לא הצליחה. בדקו את החיבור ונסו שוב.' });
    }
    setBusy(false);
  };

  return (
    <form className={styles.card} aria-labelledby="pm-passcode" onSubmit={save}>
      <h2 id="pm-passcode" className={styles.cardTitle}>
        <Icon name="lock" /> קוד הורים
      </h2>
      <p className={styles.muted}>
        {family?.passcodeSet
          ? `נקבע קוד${family.passcodeUpdatedAt ? ` (עודכן ${when.format(new Date(family.passcodeUpdatedAt))})` : ''}. קוד חדש מחליף אותו בכל המכשירים המחוברים; כך גם משחזרים קוד שנשכח.`
          : 'עוד לא נקבע קוד. הקוד פותח את אזור ההורים במכשירים של הילדים, ונבדק שם גם בלי אינטרנט.'}
      </p>
      <PasscodeField label="קוד הורים חדש" value={first} onChange={setFirst} />
      <PasscodeRules passcode={first} />
      <PasscodeField label="שוב, לאישור" value={second} onChange={setSecond} />
      {message && (
        <p className={message.ok ? styles.ok : styles.danger} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <TactileButton type="submit" tone="success" icon="check" disabled={busy || !first}>
        {busy ? 'שומר...' : 'שמירת הקוד'}
      </TactileButton>
    </form>
  );
}
