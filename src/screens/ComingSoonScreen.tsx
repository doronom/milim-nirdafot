import { MascotBubble } from '../ui/MascotBubble';
import { TopBar } from '../ui/TopBar';
import styles from './ComingSoonScreen.module.css';

/** Placeholder for tabs and areas that later milestones fill in. */
export function ComingSoonScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.screen}>
      <TopBar title={title} />
      <div className={styles.body}>
        <MascotBubble>{message}</MascotBubble>
      </div>
    </div>
  );
}
