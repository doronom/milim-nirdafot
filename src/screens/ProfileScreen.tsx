import { nextRank, RANKS, rankForXp, WORLDS } from '../config/game';
import { dayKey } from '../engine/dates';
import { isLevelDone } from '../engine/progress';
import { currentStreak, weekCalendar } from '../engine/streak';
import { layout } from '../app/data';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { TactileButton } from '../ui/TactileButton';
import { TopBar } from '../ui/TopBar';
import styles from './ProfileScreen.module.css';

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** Rank and XP, the streak with its weekly calendar (no guilt), and certificates for completed worlds. */
export function ProfileScreen() {
  const { progress } = useProgress();
  const today = dayKey();
  const rank = rankForXp(progress.xp);
  const next = nextRank(progress.xp);
  const from = RANKS.find((r) => r.name === rank)!.minXp;
  const streak = currentStreak(progress.streak, today);

  return (
    <div className={styles.screen}>
      <TopBar title={progress.settings.childName ? `הפרופיל של ${progress.settings.childName}` : 'הפרופיל שלי'} />
      <div className={styles.body}>
        <section className={styles.card} aria-label="דרגה">
          <div className={styles.row}>
            <span className={styles.medal}>
              <Icon name="trophy" size="xl" />
            </span>
            <div>
              <p className={styles.label}>דרגת משלחת</p>
              <p className={styles.big}>{rank}</p>
            </div>
            <Pill tone="xp">XP {progress.xp}</Pill>
          </div>
          {next ? (
            <>
              <ProgressBar value={progress.xp - from} max={next.minXp - from} label="התקדמות לדרגה הבאה" />
              <p className={styles.label}>
                עוד {next.minXp - progress.xp} XP לדרגת {next.name}
              </p>
            </>
          ) : (
            <p className={styles.label}>הגעתם לדרגה העליונה!</p>
          )}
        </section>

        <section className={styles.card} aria-label="רצף">
          <div className={styles.row}>
            <span className={styles.flame}>
              <Icon name="flame" size="xl" />
            </span>
            <div>
              <p className={styles.big}>{streak} ימים ברצף</p>
              <p className={styles.label}>
                <Icon name="snowflake" size="sm" />
                {progress.streak.freezes > 0 ? 'מגן הקפאה אחד זמין השבוע' : 'מגן ההקפאה של השבוע כבר שמר עליכם'}
              </p>
            </div>
          </div>
          <ol className={styles.week} aria-label="השבוע">
            {weekCalendar(progress.streak, today).map((d, i) => (
              <li
                key={d.day}
                className={`${styles.day} ${styles[d.state]}`}
                aria-label={`${DAY_LETTERS[i]}: ${d.state === 'played' ? 'שוחק' : d.state === 'frozen' ? 'מוגן בהקפאה' : ''}`}
              >
                <span className={styles.dot}>
                  {d.state === 'played' ? (
                    <Icon name="check" size="sm" />
                  ) : d.state === 'frozen' ? (
                    <Icon name="snowflake" size="sm" />
                  ) : null}
                </span>
                <span>{DAY_LETTERS[i]}</span>
              </li>
            ))}
          </ol>
          <p className={styles.kind}>פספסתם יום? לא נורא. כל מה שלמדתם נשמר, ומגן ההקפאה מכסה יום אחד בכל שבוע.</p>
        </section>

        <section className={styles.card} aria-label="תעודות">
          <p className={styles.sectionTitle}>התעודות שלי</p>
          {layout.worlds.map((w) => {
            const config = WORLDS.find((x) => x.id === w.id)!;
            const done = isLevelDone(progress, w.boss.id);
            return (
              <div key={w.id} data-world={w.id} className={styles.cert}>
                <Icon name={config.icon} />
                <span className={styles.certName}>{config.name}</span>
                {done ? (
                  <TactileButton icon="sparkle" to={`/certificate/${w.id}`}>
                    לתעודה
                  </TactileButton>
                ) : (
                  <span className={styles.label}>
                    <Icon name="lock" size="sm" />
                    אחרי קרב הבוס
                  </span>
                )}
              </div>
            );
          })}
        </section>

        {progress.speedBest && (
          <section className={styles.card} aria-label="שיא מהירות">
            <p className={styles.row}>
              <Icon name="bolt" />
              שיא באתגר המהירות: {progress.speedBest.score}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
