import { Icon } from '../../ui/Icon';
import styles from './HebrewKeyboard.module.css';

/** Standard Israeli layout, right to left, with the final letters on their own keys. */
const ROWS = [
  ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
];

/** On-screen keyboard, so the system keyboard never opens. */
export function HebrewKeyboard({
  onKey,
  onBackspace,
  onSpace,
}: {
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
}) {
  return (
    <div className={styles.keyboard} role="group" aria-label="מקלדת">
      {ROWS.map((row, i) => (
        <div key={i} className={styles.row}>
          {row.map((k) => (
            <button key={k} type="button" className={styles.key} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
      ))}
      <div className={styles.row}>
        <button type="button" className={`${styles.key} ${styles.wide}`} onClick={onBackspace} aria-label="מחק אות">
          <Icon name="backspace" />
        </button>
        <button type="button" className={`${styles.key} ${styles.space}`} onClick={onSpace} aria-label="רווח">
          רווח
        </button>
      </div>
    </div>
  );
}
