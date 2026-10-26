import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { DAILY_GOALS, dailyGoal, type DailyGoal } from '../../engine/activity';
import { resetJourney, type Progress } from '../../engine/progress';
import { passcodeProblems, PROBLEM_TEXT } from '../../engine/passcode';
import { changePasscode } from '../../state/parent-lock';
import { useProgress } from '../../state/progress-context';
import { useStore } from '../../state/store-context';
import { useParentLog } from '../../state/use-parent-log';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { Field, PasscodeField, Segmented, Toggle } from './controls';
import { PasscodeRules } from './ParentLock';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

const GOAL_NOTE: Record<DailyGoal, string> = { 10: 'קליל', 15: 'מאוזן', 20: 'מעמיק' };

/** How each setting reads in the activity log. */
const SETTING_NAMES: Partial<Record<keyof Progress['settings'], string>> = {
  sound: 'צלילי משחק',
  voice: 'הקראה קולית',
  unlockAll: 'פתיחת כל השלבים והעולמות',
  reviewedOnly: 'רק מילים שנבדקו',
  reviewedSentencesOnly: 'רק משפטים שנבדקו',
  speedMode: 'אתגר מהירות',
};

function describe(patch: Partial<Progress['settings']>): string[] {
  return Object.entries(patch).map(([key, value]) => {
    if (key === 'dailyGoal') return `יעד יומי: ${String(value)} דקות`;
    if (key === 'childName') return `שם הילד: ${String(value) || '(ריק)'}`;
    return `${SETTING_NAMES[key as keyof Progress['settings']] ?? key}: ${value ? 'הופעל' : 'כובה'}`;
  });
}

/** Settings apply as soon as they change; reset is the only step that asks twice. */
export function ParentSettings() {
  const { progress, update } = useProgress();
  const s = progress.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const log = useParentLog();
  const apply = (patch: Partial<Progress['settings']>) =>
    update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const set = (patch: Partial<Progress['settings']>) => {
    apply(patch);
    describe(patch).forEach((line) => log(`הגדרה: ${line}`));
  };

  return (
    <ParentPage title="הגדרות">
      <section className={styles.card} aria-labelledby="set-sound">
        <h2 id="set-sound" className={styles.cardTitle}>
          <Icon name="speaker" /> שמע
        </h2>
        <Toggle
          title="צלילי משחק"
          description="צלילים קצרים לתשובות ולמעברים"
          on={s.sound !== false}
          onChange={(on) => set({ sound: on })}
        />
        <hr className={styles.divider} />
        <Toggle
          title="הקראה קולית של מילים"
          description="הקראה בכרטיסי הלימוד; הקלטות שלכם קודמות להקראה"
          on={s.voice !== false}
          onChange={(on) => set({ voice: on })}
        />
      </section>

      <section className={styles.card} aria-labelledby="set-goal">
        <h2 id="set-goal" className={styles.cardTitle}>
          <Icon name="clock" /> יעד יומי
        </h2>
        <Segmented
          label="יעד יומי בדקות"
          value={dailyGoal(progress)}
          options={DAILY_GOALS.map((g) => ({ value: g, title: `${g} דק׳`, note: GOAL_NOTE[g] }))}
          onChange={(g) => set({ dailyGoal: g })}
        />
        <p className={styles.notice}>כשהיעד מושג מופיעה הודעה עדינה במפה. המשחק לא ננעל ולא נעצר.</p>
      </section>

      <section className={styles.card} aria-labelledby="set-content">
        <h2 id="set-content" className={styles.cardTitle}>
          <Icon name="map" /> תוכן ומסע
        </h2>
        <Field label="שם הילד/ה (לתעודה ולברכות)">
          <input
            className={styles.input}
            value={s.childName ?? ''}
            maxLength={30}
            onChange={(e) => apply({ childName: e.target.value })}
            onBlur={(e) => log(`הגדרה: ${describe({ childName: e.target.value })[0]}`)}
          />
        </Field>
        <Toggle
          title="פתיחת כל השלבים והעולמות"
          description="לבדיקת התוכן על ידי הורים"
          on={s.unlockAll}
          onChange={(on) => set({ unlockAll: on })}
        />
        <hr className={styles.divider} />
        <Toggle
          title="רק מילים שנבדקו"
          description="תוכן שעוד לא אושר בבדיקת התוכן לא יופיע"
          on={s.reviewedOnly}
          onChange={(on) => set({ reviewedOnly: on })}
        />
        <hr className={styles.divider} />
        <Toggle
          title="רק משפטים שנבדקו"
          description="משחק החלפת המילה ישתמש רק במשפטים שאושרו"
          on={s.reviewedSentencesOnly ?? false}
          onChange={(on) => set({ reviewedSentencesOnly: on })}
        />
        <hr className={styles.divider} />
        <Toggle
          title="אתגר מהירות"
          description="אתגר 60 שניות, נפתח אחרי שעולם 4 נפתח"
          on={s.speedMode !== false}
          onChange={(on) => set({ speedMode: on })}
        />
      </section>

      <ChangePasscode />

      <section className={styles.card} aria-labelledby="set-reset">
        <h2 id="set-reset" className={`${styles.cardTitle} ${styles.danger}`}>
          <Icon name="refresh" /> איפוס
        </h2>
        <p className={styles.muted}>
          איפוס מוחק את ההתקדמות: שלבים, נקודות, רצף, אלבום, תיבות חזרה וזמני משחק. ההגדרות, המילים שלכם ושינויי התוכן
          נשמרים.
        </p>
        {resetDone && (
          <p className={styles.ok} role="status">
            המסע אופס.
          </p>
        )}
        {!confirmReset ? (
          <TactileButton tone="quiet" icon="refresh" onClick={() => setConfirmReset(true)}>
            איפוס נתוני המסע
          </TactileButton>
        ) : (
          <div className={styles.error} role="alert">
            <strong>בטוחים? אי אפשר לבטל את זה.</strong>
            <span>מומלץ לייצא גיבוי לפני כן.</span>
            <div className={styles.actions}>
              <TactileButton
                tone="danger"
                icon="trash"
                onClick={() => {
                  update(resetJourney);
                  log('איפוס נתוני המסע');
                  setConfirmReset(false);
                  setResetDone(true);
                }}
              >
                כן, לאפס הכל
              </TactileButton>
              <TactileButton tone="quiet" onClick={() => setConfirmReset(false)}>
                ביטול
              </TactileButton>
            </div>
          </div>
        )}
      </section>
    </ParentPage>
  );
}

/** Changing the passcode needs the current one; a wrong one counts towards the lockout. */
function ChangePasscode() {
  const store = useStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const problems = passcodeProblems(next);
    if (problems.length > 0)
      return setMessage({ ok: false, text: `הקוד החדש צריך: ${problems.map((x) => PROBLEM_TEXT[x]).join('; ')}` });
    if (next !== again) return setMessage({ ok: false, text: 'שני הקודים החדשים לא זהים.' });
    setBusy(true);
    const r = await changePasscode(store, current, next);
    setBusy(false);
    setCurrent('');
    if (r.kind === 'ok') {
      setNext('');
      setAgain('');
      return setMessage({ ok: true, text: 'קוד ההורים שונה. קוד השחזור לא השתנה.' });
    }
    setMessage({
      ok: false,
      text:
        r.kind === 'locked'
          ? 'יותר מדי ניסיונות שגויים. שינוי הקוד והכניסה נעולים זמנית.'
          : `הקוד הנוכחי שגוי (${r.left === 1 ? 'נותר ניסיון אחד' : `נותרו ${r.left} ניסיונות`} לפני נעילה).`,
    });
  };
  return (
    <form className={styles.card} aria-labelledby="set-passcode" onSubmit={send}>
      <h2 id="set-passcode" className={styles.cardTitle}>
        <Icon name="lock" /> קוד הורים
      </h2>
      <p className={styles.muted}>
        כל כניסה וכל שינוי כאן נרשמים ב<Link to="/parent/log">יומן הפעילות</Link>.
      </p>
      <PasscodeField label="הקוד הנוכחי" value={current} onChange={setCurrent} />
      <PasscodeField label="קוד חדש" value={next} onChange={setNext} />
      <PasscodeRules passcode={next} />
      <PasscodeField label="הקוד החדש שוב, לאישור" value={again} onChange={setAgain} />
      {message && (
        <p className={message.ok ? styles.ok : styles.danger} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <TactileButton type="submit" tone="quiet" icon="lock" disabled={busy || !current || !next}>
        {busy ? 'בודק...' : 'שינוי הקוד'}
      </TactileButton>
    </form>
  );
}
