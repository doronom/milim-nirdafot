import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { IconButton, TopBar } from '../../ui/TopBar';
import { ParentGate } from './ParentGate';
import styles from './parent.module.css';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/parent', label: 'מבט כולל', icon: 'chart', end: true },
  { to: '/parent/words', label: 'המילים שלי', icon: 'plus' },
  { to: '/parent/content', label: 'תוכן', icon: 'book' },
  { to: '/parent/settings', label: 'הגדרות', icon: 'settings' },
  { to: '/parent/backup', label: 'גיבוי', icon: 'shield' },
];

/**
 * The parent area: behind the gate every time it is entered from the child's side. Moving between its tabs keeps it
 * open; leaving to the game closes it.
 */
export function ParentArea() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Each tab starts at its top, not at the scroll position of the previous one.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
  }, [pathname, open]);
  if (!open) return <ParentGate onOpen={() => setOpen(true)} />;
  return (
    <div className={styles.area}>
      <Outlet />
      <nav className={styles.nav} aria-label="ניווט אזור ההורים">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `${styles.navTab} ${isActive ? styles.navActive : ''}`}
          >
            <span className={styles.navIcon}>
              <Icon name={t.icon} size="lg" />
            </span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** One parent page: a top bar with the way back to the game, then the content. */
export function ParentPage({
  title,
  subtitle,
  end,
  children,
}: {
  title: string;
  subtitle?: string;
  end?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      <TopBar
        start={
          <IconButton label="חזרה למסע" onClick={() => navigate('/')}>
            <Icon name="forward" />
          </IconButton>
        }
        title={title}
        subtitle={subtitle}
        end={end}
      />
      <main className={styles.body}>{children}</main>
    </>
  );
}
