import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';
import styles from './Pill.module.css';

export function Pill({
  children,
  icon,
  tone = 'muted',
  label,
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: 'world' | 'xp' | 'guest' | 'muted' | 'frost' | 'success';
  /** Spoken label when the visible text is terse (e.g. "XP 420"). */
  label?: string;
}) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`} aria-label={label}>
      {icon && <Icon name={icon} size="sm" />}
      <span className={styles.text}>{children}</span>
    </span>
  );
}
