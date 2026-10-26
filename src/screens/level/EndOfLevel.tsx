import { motion as m } from 'framer-motion';
import { motion } from '../../design/tokens';
import type { Stars } from '../../engine/progress';
import type { Sticker as StickerDef } from '../../engine/album';
import { Icon } from '../../ui/Icon';
import { Sticker } from '../../ui/Sticker';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import styles from './EndOfLevel.module.css';

const VERDICT: Record<Stars, { title: string; line: string }> = {
  0: { title: 'השלב הושלם', line: '' },
  1: { title: 'הושלם בהצלחה!', line: 'כל הכבוד על ההתמדה. בפעם הבאה ננסה לאסוף עוד כוכבים.' },
  2: { title: 'טוב מאוד!', line: 'עוד קצת תרגול לציון מושלם!' },
  3: { title: 'מושלם!', line: 'פענחתם את כל המילים בדיוק של חוקר אמיתי!' },
};

interface Props {
  levelName: string;
  stars: Stars;
  accuracy: number;
  xp: number;
  wordsLearned: number;
  wordsTotal: number;
  practise: string[];
  nextTo?: string;
  nextLabel?: string;
  pathTo: string;
  onReplay: () => void;
  /** Set when this level awarded a new sticker. */
  sticker?: StickerDef;
}

/** The result screen: stars revealed one by one, accuracy, XP, words to practise, and where to go next. */
export function EndOfLevel({
  levelName,
  stars,
  accuracy,
  xp,
  wordsLearned,
  wordsTotal,
  practise,
  nextTo,
  nextLabel,
  pathTo,
  onReplay,
  sticker,
}: Props) {
  const reveal = motion('star_reveal');
  const verdict = VERDICT[stars];
  return (
    <div className={styles.screen}>
      <Pill tone="success">ההרפתקה הושלמה</Pill>
      <h2 className={styles.title}>
        {levelName}: {verdict.title}
      </h2>
      <p className={styles.line}>{verdict.line}</p>
      <div className={styles.stars} role="img" aria-label={`${stars} מתוך 3 כוכבים`}>
        {[1, 2, 3].map((n) => (
          <m.span
            key={n}
            className={n <= stars ? styles.starOn : styles.starOff}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...reveal, delay: (n - 1) * 0.2 }}
          >
            <Icon name="star" size="xl" />
          </m.span>
        ))}
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{Math.round(accuracy * 100)}%</span>
          <span className={styles.statLabel}>דיוק</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {wordsLearned}/{wordsTotal}
          </span>
          <span className={styles.statLabel}>מילים נלמדו</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.xp}`}>+{xp}</span>
          <span className={styles.statLabel}>XP</span>
        </div>
      </div>
      {sticker && (
        <section className={styles.sticker} aria-label="מדבקה חדשה">
          <Sticker sticker={sticker} />
          <div>
            <p className={styles.practiseTitle}>מדבקה חדשה נאספה!</p>
            <TactileButton tone="quiet" icon="book" to="/treasures">
              להדביק באלבום
            </TactileButton>
          </div>
        </section>
      )}
      {practise.length > 0 && (
        <section className={styles.practise} aria-label="מילים לתרגול">
          <p className={styles.practiseTitle}>מילים שכדאי לתרגל שוב:</p>
          <ul className={styles.practiseList}>
            {practise.map((w) => (
              <li key={w} className={styles.practiseWord}>
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.actions}>
        {nextTo && (
          <TactileButton block size="lg" icon="forward" to={nextTo}>
            {nextLabel}
          </TactileButton>
        )}
        <TactileButton block tone="quiet" icon="map" to={pathTo}>
          חזרה למפת התחנות
        </TactileButton>
        <TactileButton block tone="quiet" icon="refresh" onClick={onReplay}>
          לשחק שוב
        </TactileButton>
      </div>
    </div>
  );
}
