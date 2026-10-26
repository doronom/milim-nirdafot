import { Outlet } from 'react-router';
import { BottomNav } from '../ui/BottomNav';
import styles from './AppShell.module.css';

/** Tab screens: content scrolls between the sticky top bar (rendered by each screen) and the bottom nav. */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
