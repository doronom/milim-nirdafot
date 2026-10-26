import { speedAvailable } from '../engine/progress';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { TactileButton } from '../ui/TactileButton';
import { TopBar } from '../ui/TopBar';
import styles from './AdventureScreen.module.css';

/** Optional extras outside the path: the speed challenge now, the duel in a later milestone. */
export function AdventureScreen() {
  const { progress } = useProgress();
  const speed = speedAvailable(progress);
  return (
    <div data-world={4} className={styles.screen}>
      <TopBar title="הרפתקה" />
      <div className={styles.body}>
        <article className={styles.card} aria-label="אתגר מהירות">
          <div className={styles.head}>
            <span className={styles.icon}>
              <Icon name="bolt" size="xl" />
            </span>
            <div>
              <h2 className={styles.title}>אתגר מהירות</h2>
              <p className={styles.text}>60 שניות של מילים נרדפות, קומבו ושיא אישי.</p>
            </div>
          </div>
          {speed ? (
            <>
              {progress.speedBest && (
                <Pill tone="xp" icon="trophy">
                  השיא שלכם: {progress.speedBest.score}
                </Pill>
              )}
              <TactileButton block icon="bolt" to="/speed">
                לאתגר
              </TactileButton>
            </>
          ) : (
            <p className={styles.locked}>
              <Icon name="lock" size="sm" />
              {progress.settings.speedMode === false ? 'האתגר כבוי בהגדרות ההורים.' : 'נפתח כשמגיעים למגדל המומחים.'}
            </p>
          )}
        </article>
        <article className={`${styles.card} ${styles.soon}`} aria-label="דו-קרב">
          <div className={styles.head}>
            <span className={styles.icon}>
              <Icon name="swords" size="xl" />
            </span>
            <div>
              <h2 className={styles.title}>דו-קרב</h2>
              <p className={styles.text}>שני שחקנים, טלפון אחד. בקרוב!</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
