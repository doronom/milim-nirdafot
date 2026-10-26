import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

/** Sticky expedition bar: start (right in RTL), title, end (left in RTL). */
export function TopBar({
  start,
  title,
  subtitle,
  end,
}: {
  start?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>{start}</div>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={`${styles.side} ${styles.end}`}>{end}</div>
    </header>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.iconButton} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
