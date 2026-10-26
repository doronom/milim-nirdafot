import { useEffect, useState } from 'react';
import { isFailure, listLog, type LogEntry } from '../../state/parent-log';
import { useStore } from '../../state/store-context';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

type Filter = 'all' | 'entries' | 'changes';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'entries', label: 'כניסות' },
  { id: 'changes', label: 'שינויים' },
];
const ICON: Record<LogEntry['kind'], IconName> = {
  entry: 'check',
  recovery: 'key',
  'entry-failed': 'close',
  'recovery-failed': 'close',
  lockout: 'lock',
  passcode: 'lock',
  change: 'edit',
};
const isEntry = (e: LogEntry) => e.kind !== 'change';
const day = new Intl.DateTimeFormat('he', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('he', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Every entry to the parent area (successful and failed) and every change made in it, newest first. */
export function ActivityLog() {
  const store = useStore();
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    let cancelled = false;
    void listLog(store).then((l) => !cancelled && setLog(l));
    return () => {
      cancelled = true;
    };
  }, [store]);
  const shown = (log ?? [])
    .filter((e) => filter === 'all' || (filter === 'entries' ? isEntry(e) : !isEntry(e)))
    .reverse();
  const days = new Map<string, LogEntry[]>();
  for (const e of shown) {
    const key = day.format(new Date(e.at));
    days.set(key, [...(days.get(key) ?? []), e]);
  }

  return (
    <ParentPage title="יומן פעילות" subtitle="כניסות לאזור ההורים ושינויים שנעשו בו">
      <div className={styles.tabs} role="tablist" aria-label="סינון היומן">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`${styles.tab} ${filter === f.id ? styles.tabActive : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {log && shown.length === 0 && <p className={styles.notice}>אין רשומות.</p>}
      {[...days].map(([label, entries]) => (
        <section key={label} className={styles.card} aria-label={label}>
          <h2 className={styles.toggleTitle}>{label}</h2>
          <ul className={styles.list}>
            {entries.map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className={`${styles.row} ${isFailure(e) || e.kind === 'lockout' ? styles.danger : ''}`}
              >
                <Icon name={ICON[e.kind]} size="sm" />
                <span>{e.text}</span>
                <time className={styles.caption} dateTime={e.at}>
                  {time.format(new Date(e.at))}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className={styles.caption}>נשמרות 1,000 הרשומות האחרונות, במכשיר הזה בלבד (לא בגיבוי).</p>
    </ParentPage>
  );
}
