import { motion as m } from 'framer-motion';
import collectible from '../../design/assets/collectible-anchor.svg';
import { useSfx } from '../../audio/sfx';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import styles from './BossResults.module.css';

interface Props {
  passed: boolean;
  correct: number;
  total: number;
  needed: number;
  /** The world the pass opens, if any (none after World 4). */
  unlocked?: { id: number; name: string };
  practise: string[];
  pathTo: string;
  /** The certificate of the world just completed. */
  certificateTo?: string;
  onRetry: () => void;
}

/** Boss results: a pass opens the next world; "not yet" lists the words to practise and never takes anything away. */
export function BossResults({
  passed,
  correct,
  total,
  needed,
  unlocked,
  practise,
  pathTo,
  certificateTo,
  onRetry,
}: Props) {
  useSfx(passed ? 'complete' : null);
  const pct = Math.round((correct / total) * 100);
  return (
    <div className={styles.screen}>
      <m.div
        className={`${styles.badge} ${passed ? styles.won : ''}`}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={motion('world_unlock')}
      >
        {passed ? <img src={collectible} alt="" className={styles.art} /> : <Icon name="shield" size="xl" />}
      </m.div>
      <Pill tone={passed ? 'success' : 'xp'}>{passed ? 'ניצחון' : 'עוד לא'}</Pill>
      <h2 className={styles.title}>{passed ? 'הבוס נוצח!' : 'כמעט שם!'}</h2>
      <p className={styles.line}>
        {passed
          ? unlocked
            ? `פתחתם את ${unlocked.name}!`
            : 'סיימתם את כל המסע. אלופי המילים!'
          : `צריך ${needed} תשובות נכונות כדי לעבור. כל מה שלמדתם נשמר, ואפשר לנסות שוב מתי שרוצים.`}
      </p>
      <div className={styles.score}>
        <span className={styles.label}>תשובות נכונות</span>
        <span className={styles.big}>
          {correct} / {total}
        </span>
        <span className={styles.pct}>{pct}% דיוק</span>
      </div>
      {!passed && practise.length > 0 && (
        <section className={styles.practise} aria-label="מילים לתרגול">
          <p className={styles.practiseTitle}>כדאי לתרגל לפני הניסיון הבא:</p>
          <ul className={styles.list}>
            {practise.map((w) => (
              <li key={w} className={styles.word}>
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.actions}>
        {passed && unlocked && (
          <TactileButton tone="success" block size="lg" icon="forward" to={`/world/${unlocked.id}`}>
            לעולם הבא: {unlocked.name}
          </TactileButton>
        )}
        {passed && certificateTo && (
          <TactileButton block tone="quiet" icon="sparkle" to={certificateTo}>
            פתיחת תעודת ההצטיינות
          </TactileButton>
        )}
        {!passed && (
          <TactileButton block size="lg" icon="refresh" onClick={onRetry}>
            לנסות שוב
          </TactileButton>
        )}
        <TactileButton block tone="quiet" icon="map" to={passed ? '/' : pathTo}>
          {passed ? 'חזרה למפת העולמות' : 'לתרגל בשביל התחנות'}
        </TactileButton>
      </div>
    </div>
  );
}
