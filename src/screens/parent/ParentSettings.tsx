import { useState } from 'react';
import { Link } from 'react-router';
import { DAILY_GOALS, dailyGoal, type DailyGoal } from '../../engine/activity';
import { resetJourney, type Progress } from '../../engine/progress';
import { useProgress } from '../../state/progress-context';
import { useParentLog } from '../../state/use-parent-log';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import type { CloudResult } from '../../sync/child';
import { useSync } from '../../sync/sync-context';
import { Field, Segmented, Toggle } from './controls';
import { PairDevice } from './PairDevice';
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

      <CloudSection />

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

const when = new Intl.DateTimeFormat('he', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Cloud sync on this (the child's) device: pairing with the parents' phones, the last upload, and unpairing or deleting
 * the cloud data. The passcode itself is set and changed in parent mode on a parent's phone.
 */
function CloudSection() {
  const { paired, lastUploadAt, syncNow, unpair, deleteCloudData } = useSync();
  const [pairing, setPairing] = useState(false);
  const [confirm, setConfirm] = useState<'unpair' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<CloudResult>, ok: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setConfirm(null);
    setMessage(
      result === 'ok'
        ? { ok: true, text: ok }
        : {
            ok: false,
            text: result === 'offline' ? 'אין חיבור לאינטרנט. נסו שוב כשיש רשת.' : 'הפעולה לא הצליחה. נסו שוב.',
          },
    );
  };
  return (
    <section className={styles.card} aria-labelledby="set-cloud">
      <h2 id="set-cloud" className={styles.cardTitle}>
        <Icon name="upload" /> סנכרון עם הטלפון של ההורה
      </h2>
      {paired ? (
        <>
          <p className={styles.muted}>
            המכשיר מחובר. ההתקדמות נשלחת לטלפון של ההורה כשיש רשת (שם פרטי והתקדמות בלבד, בלי הקלטות). קוד ההורים נקבע
            ומשתנה במצב הורים בטלפון.
          </p>
          <p className={styles.caption}>
            סנכרון אחרון: {lastUploadAt ? when.format(new Date(lastUploadAt)) : 'עוד לא'}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.linkButton}
              disabled={busy}
              onClick={() => void run(syncNow, 'הסנכרון הושלם.')}
            >
              <Icon name="refresh" size="sm" /> סנכרון עכשיו
            </button>
            <button type="button" className={styles.linkButton} disabled={busy} onClick={() => setConfirm('unpair')}>
              <Icon name="close" size="sm" /> ניתוק מהטלפון של ההורה
            </button>
            <button type="button" className={styles.linkButton} disabled={busy} onClick={() => setConfirm('delete')}>
              <Icon name="trash" size="sm" /> מחיקת נתוני הענן
            </button>
          </div>
          {confirm && (
            <div className={styles.error} role="alert">
              <strong>{confirm === 'unpair' ? 'לנתק את המכשיר?' : 'למחוק את נתוני הענן?'}</strong>
              <span>
                {confirm === 'unpair'
                  ? 'ההורים לא יראו יותר את ההתקדמות. ההתקדמות וקוד ההורים במכשיר נשארים.'
                  : 'הפרופיל נמחק מהענן והמכשיר מתנתק. ההתקדמות וקוד ההורים במכשיר נשארים.'}
              </span>
              <div className={styles.actions}>
                <TactileButton
                  tone="danger"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      confirm === 'unpair' ? unpair : deleteCloudData,
                      confirm === 'unpair' ? 'המכשיר נותק.' : 'נתוני הענן נמחקו.',
                    )
                  }
                >
                  {confirm === 'unpair' ? 'כן, לנתק' : 'כן, למחוק'}
                </TactileButton>
                <TactileButton tone="quiet" onClick={() => setConfirm(null)}>
                  ביטול
                </TactileButton>
              </div>
            </div>
          )}
        </>
      ) : pairing ? (
        <PairDevice onPaired={() => setPairing(false)} />
      ) : (
        <>
          <p className={styles.muted}>
            המכשיר לא מחובר. חיבור לטלפון של ההורה מאפשר לראות את ההתקדמות מרחוק, ומעביר למכשיר את קוד ההורים שנקבע במצב
            הורים (במקום הקוד שבמכשיר).
          </p>
          <TactileButton tone="quiet" icon="key" onClick={() => setPairing(true)}>
            חיבור לטלפון של ההורה
          </TactileButton>
        </>
      )}
      {message && (
        <p className={message.ok ? styles.ok : styles.danger} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <p className={styles.caption}>
        כל כניסה וכל שינוי כאן נרשמים ב<Link to="/parent/log">יומן הפעילות</Link>.
      </p>
    </section>
  );
}
