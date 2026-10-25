import { AnimatePresence, motion as m } from 'framer-motion';
import { useState } from 'react';
import { speak } from '../../audio/speak';
import type { Entry, Sentence } from '../../content/types';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { ProgressBar } from '../../ui/ProgressBar';
import { TactileButton } from '../../ui/TactileButton';
import styles from './LearnCards.module.css';

interface Props {
  entries: Entry[];
  sentenceFor: (entry: Entry) => Sentence | undefined;
  displayWord: (w: string) => string;
  onDone: (knownEntryIds: string[]) => void;
}

/** One card per new word: tap to hear, synonyms, an example, and an "I already know this word" switch. */
export function LearnCards({ entries, sentenceFor, displayWord, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState<string[]>([]);
  const entry = entries[index]!;
  const sentence = sentenceFor(entry);
  const isKnown = known.includes(entry.id);
  const last = index === entries.length - 1;
  const word = displayWord(entry.headword);

  return (
    <div className={styles.wrap}>
      <div className={styles.progress}>
        <span className={styles.count}>
          מילה {index + 1} מתוך {entries.length}
        </span>
        <ProgressBar value={index + 1} max={entries.length} label="התקדמות בכרטיסי הלימוד" />
      </div>
      <AnimatePresence mode="wait">
        <m.article
          key={entry.id}
          className={styles.card}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={motion('card_snap')}
          aria-label={`כרטיס לימוד: ${word}`}
        >
          <div className={styles.head}>
            <div>
              <p className={styles.label}>מילת המטרה:</p>
              <p className={styles.word}>{word}</p>
              {entry.hint && <Pill tone="world">{entry.hint}</Pill>}
            </div>
            <button
              type="button"
              className={styles.speaker}
              aria-label={`השמע את המילה ${word}`}
              onClick={() => speak([entry.headword, ...entry.synonyms].join(', '))}
            >
              <Icon name="speaker" size="lg" />
            </button>
          </div>
          <div>
            <p className={styles.sectionTitle}>
              <Icon name="sparkle" size="sm" />
              מילים נרדפות:
            </p>
            <ul className={styles.synonyms}>
              {entry.synonyms.map((s) => (
                <li key={s}>
                  <button type="button" className={styles.synonym} onClick={() => speak(s)}>
                    {displayWord(s)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {sentence && (
            <blockquote className={styles.sentence}>
              <p className={styles.sectionTitle}>שימוש ביומן המסע:</p>
              <p>{sentence.text}</p>
            </blockquote>
          )}
        </m.article>
      </AnimatePresence>
      <button
        type="button"
        role="switch"
        aria-checked={isKnown}
        className={styles.known}
        onClick={() => setKnown(isKnown ? known.filter((k) => k !== entry.id) : [...known, entry.id])}
      >
        <span>אני כבר מכיר/ה את המילה הזו</span>
        <span className={`${styles.switch} ${isKnown ? styles.switchOn : ''}`} aria-hidden>
          <span className={styles.knob} />
        </span>
      </button>
      <div className={styles.actions}>
        {index > 0 && (
          <TactileButton tone="quiet" onClick={() => setIndex(index - 1)}>
            הקודם
          </TactileButton>
        )}
        <TactileButton block size="lg" icon="forward" onClick={() => (last ? onDone(known) : setIndex(index + 1))}>
          {last ? 'הבנתי, בואו נתרגל!' : 'הבנתי, הבא'}
        </TactileButton>
      </div>
    </div>
  );
}
