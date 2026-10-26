import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { WORLDS } from '../../config/game';
import { dailyGoal, minutesOn, recentMinutes } from '../../engine/activity';
import { BOXES, boxCounts, masteredKeys, strugglingKeys, wordSummary } from '../../engine/dashboard';
import { dayKey } from '../../engine/dates';
import { isLevelDone, isWorldUnlocked, worldStats } from '../../engine/progress';
import { useGameData } from '../../state/content-context';
import { failedSincePreviousEntry, listLog } from '../../state/parent-log';
import { useProgress } from '../../state/progress-context';
import { useStore } from '../../state/store-context';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { ProgressBar } from '../../ui/ProgressBar';
import { BarChart } from './BarChart';
import { itemLine } from './labels';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

const weekday = new Intl.DateTimeFormat('he', { weekday: 'narrow' });
const fullDay = new Intl.DateTimeFormat('he', { weekday: 'long', day: 'numeric', month: 'numeric' });
const asDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

const BOX_NOTE: Record<number, string> = {
  1: 'חדש או נשכח',
  2: 'מתחיל',
  3: 'בדרך',
  4: 'כמעט שולט',
  5: 'שולט',
};

export function Dashboard() {
  const { progress } = useProgress();
  const { layout, resolver, displayWord } = useGameData();
  const store = useStore();
  const [failed, setFailed] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void listLog(store).then((log) => !cancelled && setFailed(failedSincePreviousEntry(log)));
    return () => {
      cancelled = true;
    };
  }, [store]);
  const today = dayKey();
  const goal = dailyGoal(progress);
  const todayMinutes = minutesOn(progress, today);
  const week = recentMinutes(progress, today);
  const words = wordSummary(progress.leitner);
  const boxes = boxCounts(progress.leitner);
  const label = (key: string) => {
    const item = resolver.byKey(key);
    return item ? itemLine(item, displayWord) : null;
  };
  const struggling = strugglingKeys(progress.leitner).flatMap((k) => {
    const l = label(k);
    return l ? [{ key: k, label: l, lapses: progress.leitner[k]!.lapses }] : [];
  });
  const mastered = masteredKeys(progress.leitner, 8).flatMap((k) => {
    const l = label(k);
    return l ? [{ key: k, label: l }] : [];
  });

  return (
    <ParentPage
      title="מבט כולל"
      subtitle={progress.settings.childName ? `המסע של ${progress.settings.childName}` : undefined}
    >
      {failed > 0 && (
        <Link to="/parent/log" className={styles.error} role="alert">
          <strong>
            <Icon name="lock" size="sm" /> {failed === 1 ? 'ניסיון כניסה שגוי אחד' : `${failed} ניסיונות כניסה שגויים`}{' '}
            מאז הכניסה הקודמת
          </strong>
          <span>לפרטים ביומן הפעילות</span>
        </Link>
      )}
      <div className={styles.grid2}>
        <section className={styles.card} aria-label="דקות היום">
          <span className={styles.muted}>
            <Icon name="clock" size="sm" /> היום
          </span>
          <span className={styles.big}>
            {todayMinutes} <span className={styles.muted}>דק׳</span>
          </span>
          <ProgressBar value={Math.min(todayMinutes, goal)} max={goal} label="התקדמות ליעד היומי" />
          <span className={styles.caption}>יעד: {goal} דקות</span>
        </section>
        <section className={styles.card} aria-label="מילים">
          <span className={styles.muted}>
            <Icon name="book" size="sm" /> פריטים בתרגול
          </span>
          <span className={styles.big}>{words.total}</span>
          <span className={styles.caption}>
            <span className={styles.ok}>{words.mastered} בשליטה</span> · {words.struggling} דורשים חיזוק
          </span>
        </section>
        <section className={styles.card} aria-label="רצף">
          <span className={styles.muted}>
            <Icon name="flame" size="sm" /> רצף ימים
          </span>
          <span className={styles.big}>{progress.streak.days}</span>
          <span className={styles.caption}>מגני הקפאה: {progress.streak.freezes}</span>
        </section>
        <section className={styles.card} aria-label="נקודות">
          <span className={styles.muted}>
            <Icon name="star" size="sm" /> נקודות ניסיון
          </span>
          <span className={styles.big}>{progress.xp}</span>
          <span className={styles.caption}>{Object.keys(progress.levels).length} שלבים הושלמו</span>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>דקות משחק בשבוע האחרון</h2>
        </div>
        <BarChart
          label="דקות משחק בכל יום בשבוע האחרון"
          unit="דקות"
          reference={{ value: goal, label: `היעד היומי: ${goal} דקות` }}
          bars={week.map((d) => ({
            key: d.day,
            label: weekday.format(asDate(d.day)),
            title: fullDay.format(asDate(d.day)),
            value: d.minutes,
            highlight: d.day === today,
          }))}
        />
        <p className={styles.caption}>נספר רק זמן שבו המשחק פתוח ובשימוש, מחוץ לאזור ההורים.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>חלוקה לתיבות החזרה</h2>
        </div>
        <p className={styles.muted}>כל תשובה נכונה מעלה פריט תיבה ומרווחת את החזרה הבאה; טעות מחזירה לתיבה 1.</p>
        <BarChart
          label="מספר הפריטים בכל תיבת חזרה"
          unit="פריטים"
          bars={BOXES.map((b) => ({
            key: String(b),
            label: `תיבה ${b}`,
            title: `תיבה ${b} (${BOX_NOTE[b]})`,
            value: boxes[b],
          }))}
        />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>מילים שדורשות חיזוק</h2>
          <Pill tone="xp">{struggling.length}</Pill>
        </div>
        {struggling.length === 0 ? (
          <p className={styles.muted}>אין כרגע מילים שנכשלו בהן יותר מפעם אחת. יפה!</p>
        ) : (
          <ul className={styles.list}>
            {struggling.map((s) => (
              <li key={s.key} className={styles.item}>
                <div className={styles.row}>
                  <span className={styles.word}>{s.label}</span>
                  <span className={styles.caption}>{s.lapses} טעויות</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.caption}>הן חוזרות אוטומטית בשלבי החזרה ובאורחים שבכל שלב.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>מילים בשליטה</h2>
          <Pill tone="success">{words.mastered}</Pill>
        </div>
        {mastered.length === 0 ? (
          <p className={styles.muted}>עוד אין מילים בתיבות 4-5. הן יגיעו אחרי כמה חזרות מוצלחות לאורך זמן.</p>
        ) : (
          <div className={styles.wrap}>
            {mastered.map((m) => (
              <span key={m.key} className={styles.chip}>
                {m.label}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>התקדמות לפי עולמות ותחנות</h2>
        </div>
        {layout.worlds.map((world) => {
          const config = WORLDS.find((w) => w.id === world.id)!;
          const stats = worldStats(progress, world);
          const open = isWorldUnlocked(progress, world.id);
          return (
            <details key={world.id} className={styles.item} data-world={world.id}>
              <summary className={styles.row}>
                <span className={styles.toggleTitle}>{config.name}</span>
                <span className={styles.caption}>
                  {open ? `${stats.levelsDone}/${stats.levelsTotal} שלבים` : 'נעול'}
                  {isLevelDone(progress, world.boss.id) ? ' · הבוס הובס' : ''}
                </span>
              </summary>
              <ProgressBar value={stats.levelsDone} max={stats.levelsTotal} label={`התקדמות ב${config.name}`} />
              <ul className={styles.list}>
                {world.stations.map((s) => {
                  const done = s.levels.filter((l) => isLevelDone(progress, l.id)).length;
                  return (
                    <li key={s.id} className={styles.row}>
                      <span>
                        תחנה {s.index}: {s.title}
                      </span>
                      <span className={styles.caption}>
                        {done}/{s.levels.length}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </section>
    </ParentPage>
  );
}
