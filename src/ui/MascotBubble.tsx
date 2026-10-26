import type { ReactNode } from 'react';
import mascot from '../design/assets/mascot.svg';
import styles from './MascotBubble.module.css';

/** מצפוני, the compass guide, with a speech bubble. */
export function MascotBubble({ title = 'מצפוני המדריך', children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <img className={styles.mascot} src={mascot} alt="" />
      <div className={styles.bubble}>
        <p className={styles.title}>{title}:</p>
        <p className={styles.text}>{children}</p>
      </div>
    </div>
  );
}
