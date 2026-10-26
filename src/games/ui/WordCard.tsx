import { speak } from '../../audio/speak';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import styles from './WordCard.module.css';

/** The target word with its homograph hint and a listen button. */
export function WordCard({ word, hint, label }: { word: string; hint?: string | null; label?: string }) {
  return (
    <div className={styles.card}>
      {label && <p className={styles.label}>{label}</p>}
      <p className={styles.word} lang="he">
        {word}
      </p>
      {hint && <Pill tone="world">{hint}</Pill>}
      <button type="button" className={styles.listen} onClick={() => speak(word)}>
        <Icon name="speaker" size="sm" />
        האזן להגייה
      </button>
    </div>
  );
}
