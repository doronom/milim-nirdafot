import { NavLink, useLocation } from 'react-router';
import { Icon } from './Icon';
import type { IconName } from './icons';
import styles from './BottomNav.module.css';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  // The map tab also covers the world paths it leads to.
  { to: '/', label: 'מפה', icon: 'compass', end: true },
  { to: '/adventure', label: 'הרפתקה', icon: 'swords' },
  { to: '/treasures', label: 'אוצרות', icon: 'book' },
  { to: '/profile', label: 'פרופיל', icon: 'trophy' },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const onMap = pathname === '/' || pathname.startsWith('/world/');
  return (
    <nav className={styles.nav} aria-label="ניווט ראשי">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => `${styles.tab} ${isActive || (t.to === '/' && onMap) ? styles.active : ''}`}
        >
          <span className={styles.iconWrap}>
            <Icon name={t.icon} size="lg" />
          </span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
