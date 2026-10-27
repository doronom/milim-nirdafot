import { useSyncExternalStore } from 'react';
import { offlineAudio } from '../audio/offline-audio';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import styles from './OfflineAudioNotice.module.css';

/** Shows how much of the word audio is saved for offline use, until all of it is. */
export function OfflineAudioNotice() {
  const { done, total, state } = useSyncExternalStore(offlineAudio.subscribe, offlineAudio.get);
  if (total === 0 || (state !== 'downloading' && state !== 'paused')) return null;
  const pct = Math.floor((done / total) * 100);
  return (
    <section className={styles.notice} aria-label="שמירת ההקראות">
      <p className={styles.text}>
        <Icon name={state === 'paused' ? 'eye-off' : 'download'} size="sm" />
        {state === 'paused'
          ? `ההקראות יישמרו לשימוש בלי אינטרנט כשתחזור הרשת (${pct}%)`
          : `שומרים את ההקראות לשימוש בלי אינטרנט: ${pct}%`}
      </p>
      <ProgressBar value={done} max={total} label="ההקראות שנשמרו לשימוש בלי אינטרנט" />
    </section>
  );
}
