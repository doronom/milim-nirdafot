import { motion as m } from 'framer-motion';
import mascot from '../../design/assets/mascot.svg';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import styles from './RankUp.module.css';

/** The rank-up moment, shown over the result screen when a level's XP crosses a rank threshold. */
export function RankUp({ rank, onClose }: { rank: string; onClose: () => void }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`עליתם לדרגת ${rank}`}>
      <m.div
        className={styles.card}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={motion('rank_up')}
      >
        <span className={styles.medal}>
          <Icon name="trophy" size="xl" />
        </span>
        <p className={styles.kicker}>עליתם דרגה!</p>
        <h2 className={styles.rank}>{rank}</h2>
        <img src={mascot} alt="" className={styles.mascot} />
        <TactileButton block size="lg" icon="forward" onClick={onClose}>
          המשך בהרפתקה
        </TactileButton>
      </m.div>
    </div>
  );
}
