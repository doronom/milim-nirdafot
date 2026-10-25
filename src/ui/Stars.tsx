import { Icon } from './Icon';
import styles from './Stars.module.css';

export function Stars({ count }: { count: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${count} מתוך 3 כוכבים`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? styles.on : styles.off}>
          <Icon name="star" size="sm" />
        </span>
      ))}
    </span>
  );
}
