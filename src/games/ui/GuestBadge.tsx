import { Icon } from '../../ui/Icon';
import styles from './GuestBadge.module.css';

/** Marks a guest word: a due word from an earlier station, back for review. */
export function GuestBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${styles.badge} ${compact ? styles.compact : ''}`} title="מילה אורחת: חזרה על מילה מתחנה קודמת">
      <Icon name="refresh" size="sm" />
      {compact ? <span className="visually-hidden">מילה אורחת</span> : 'מילה אורחת · חזרה'}
    </span>
  );
}
