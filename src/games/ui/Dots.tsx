import styles from './RoundIntro.module.css';

export type DotState = 'todo' | 'current' | 'done' | 'missed';

export function Dots({ states, label }: { states: DotState[]; label: string }) {
  const cls = {
    todo: styles.dot,
    current: `${styles.dot} ${styles.dotCurrent}`,
    done: `${styles.dot} ${styles.dotDone}`,
    missed: `${styles.dot} ${styles.dotMissed}`,
  };
  return (
    <div className={styles.dots} role="img" aria-label={label}>
      {states.map((s, i) => (
        <span key={i} className={cls[s]} />
      ))}
    </div>
  );
}
