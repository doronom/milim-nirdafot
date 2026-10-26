import { dayKey } from '../engine/dates';
import { currentStreak } from '../engine/streak';
import { useProgress } from '../state/progress-context';
import { Pill } from './Pill';

/** XP and streak counters shown in the top bars. */
export function StatusPills() {
  const { progress } = useProgress();
  const days = currentStreak(progress.streak, dayKey());
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <Pill tone="frost" icon="snowflake" label={`רצף ${days} ימים, ${progress.streak.freezes} הקפאות`}>
        {days}
      </Pill>
      <Pill tone="xp" label={`${progress.xp} נקודות ניסיון`}>
        XP {progress.xp}
      </Pill>
    </div>
  );
}
