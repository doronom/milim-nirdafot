import { useState } from 'react';
import { DAILY_GOALS, dailyGoal, type DailyGoal } from '../../engine/activity';
import { resetJourney, type Progress } from '../../engine/progress';
import { useProgress } from '../../state/progress-context';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { Field, Segmented, Toggle } from './controls';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

const GOAL_NOTE: Record<DailyGoal, string> = { 10: 'קליל', 15: 'מאוזן', 20: 'מעמיק' };

/** Settings apply as soon as they change; reset is the only step that asks twice. */
export function ParentSettings() {
  const { progress, update } = useProgress();
  const s = progress.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const set = (patch: Partial<Progress['settings']>) =>
    update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

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
            onChange={(e) => set({ childName: e.target.value })}
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
