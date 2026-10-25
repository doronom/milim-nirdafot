import { useState } from 'react';
import styles from './RoundIntro.module.css';

/** "גם זו תשובה נכונה!": the wrong pick is not counted as a mistake and goes to the parent's review queue. */
export function AlsoCorrectButton({ onClaim }: { onClaim: () => void }) {
  const [claimed, setClaimed] = useState(false);
  if (claimed) return <p className={styles.alsoCorrectDone}>תודה! ההורים יבדקו את זה, וזה לא נחשב טעות.</p>;
  return (
    <button
      type="button"
      className={styles.alsoCorrect}
      onClick={() => {
        setClaimed(true);
        onClaim();
      }}
    >
      גם זו תשובה נכונה!
    </button>
  );
}
