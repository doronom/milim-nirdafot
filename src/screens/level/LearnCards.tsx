import { AnimatePresence, motion as m } from 'framer-motion';
import { useState } from 'react';
import { useLandscape } from '../../design/layout';
import { say, type Spoken } from '../../audio/player';
import { speak } from '../../audio/speak';
import type { Entry, Sentence } from '../../content/types';
import { motion } from '../../design/tokens';
import { BIN_LABEL, BINS } from '../../games/registerSort/build';
import type { ContextItem, IdiomItem, LevelItem, PracticeItem, RegisterItem, ScaleItem } from '../../games/types';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { ProgressBar } from '../../ui/ProgressBar';
import { TactileButton } from '../../ui/TactileButton';
import styles from './LearnCards.module.css';

interface Props {
  items: LevelItem[];
  sentenceFor: (entry: Entry) => Sentence | undefined;
  displayWord: (w: string) => string;
  /** The parent's recording of a custom word; it plays instead of speech. */
  recordingFor?: (entry: Entry) => Blob | undefined;
  /** Item keys the child marked "I already know this". */
  onDone: (knownKeys: string[]) => void;
}

/** What a card is called, read aloud, and labelled by. */
function describe(
  item: LevelItem,
  displayWord: (w: string) => string,
): { title: string; speech: string[]; noun: string } {
  switch (item.kind) {
    case 'pair':
      return {
        title: displayWord(item.entry.headword),
        speech: [item.entry.headword, ...item.entry.synonyms],
        noun: 'מילה',
      };
    case 'scale':
      return { title: item.scale.theme, speech: item.scale.weakToStrong, noun: 'סולם' };
    case 'register':
      return { title: item.register.meaning, speech: BINS.flatMap((b) => item.register[b]), noun: 'קבוצה' };
    case 'context':
      return {
        title: item.context.options.map(displayWord).join(' / '),
        speech: item.context.options,
        noun: 'הבחנה',
      };
    case 'idiom':
      return { title: item.idiom.idiom, speech: [item.idiom.idiom, item.idiom.example], noun: 'ביטוי' };
  }
}

/** One card per new item: tap to hear, what it teaches, and an "I already know this" switch. */
export function LearnCards({ items, sentenceFor, displayWord, recordingFor, onDone }: Props) {
  const landscape = useLandscape();
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState<string[]>([]);
  const item = items[index]!;
  const isKnown = known.includes(item.key);
  const last = index === items.length - 1;
  const { title, speech, noun } = describe(item, displayWord);

  const progress = (
    <div className={styles.progress}>
      <span className={styles.count}>
        {noun} {index + 1} מתוך {items.length}
      </span>
      <ProgressBar value={index + 1} max={items.length} label="התקדמות בכרטיסי הלימוד" />
    </div>
  );
  const card = (
    <AnimatePresence mode="wait">
      <m.article
        key={item.key}
        className={styles.card}
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={motion('card_snap')}
        aria-label={`כרטיס לימוד: ${title}`}
      >
        <div className={styles.head}>
          <div>
            <p className={styles.label}>
              {item.kind === 'pair'
                ? 'מילת המטרה:'
                : item.kind === 'scale'
                  ? 'סולם עוצמה:'
                  : item.kind === 'register'
                    ? 'משמעות:'
                    : item.kind === 'idiom'
                      ? 'ביטוי:'
                      : 'מילים קרובות:'}
            </p>
            <p className={item.kind === 'pair' ? styles.word : styles.title}>{title}</p>
            {item.kind === 'pair' && item.entry.hint && <Pill tone="world">{item.entry.hint}</Pill>}
          </div>
          <button
            type="button"
            className={styles.speaker}
            aria-label={`השמע: ${title}`}
            onClick={() => {
              // The parent's recording of a custom word replaces the headword; the synonyms follow as usual.
              const recording = item.kind === 'pair' ? recordingFor?.(item.entry) : undefined;
              const [first, ...rest] = speech;
              void say([recording ? { recording } : first!, ...rest] as Spoken[]);
            }}
          >
            <Icon name="speaker" size="lg" />
          </button>
        </div>
        {item.kind === 'pair' && <PairBody item={item} sentence={sentenceFor(item.entry)} displayWord={displayWord} />}
        {item.kind === 'scale' && <ScaleBody item={item} displayWord={displayWord} />}
        {item.kind === 'register' && <RegisterBody item={item} displayWord={displayWord} />}
        {item.kind === 'context' && <ContextBody item={item} />}
        {item.kind === 'idiom' && <IdiomBody item={item} />}
      </m.article>
    </AnimatePresence>
  );
  const controls = (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={isKnown}
        className={styles.known}
        onClick={() => setKnown(isKnown ? known.filter((k) => k !== item.key) : [...known, item.key])}
      >
        <span>{item.kind === 'pair' ? 'אני כבר מכיר/ה את המילה הזו' : 'אני כבר מכיר/ה את זה'}</span>
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
    </>
  );
  // Landscape: the card beside the progress and buttons, so "next" never needs a scroll; portrait: one stack.
  return landscape ? (
    <div className={`${styles.wrap} panes panes-wide-prompt`}>
      <div className="pane-prompt">{card}</div>
      <div className="pane-play">
        {progress}
        {controls}
      </div>
    </div>
  ) : (
    <div className={styles.wrap}>
      {progress}
      {card}
      {controls}
    </div>
  );
}

function PairBody({
  item,
  sentence,
  displayWord,
}: {
  item: PracticeItem;
  sentence?: Sentence;
  displayWord: (w: string) => string;
}) {
  return (
    <>
      <div>
        <p className={styles.sectionTitle}>
          <Icon name="sparkle" size="sm" />
          מילים נרדפות:
        </p>
        <ul className={styles.synonyms}>
          {item.entry.synonyms.map((s) => (
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
          <ListenLine text={sentence.text} />
        </blockquote>
      )}
    </>
  );
}

function ScaleBody({ item, displayWord }: { item: ScaleItem; displayWord: (w: string) => string }) {
  const words = item.scale.weakToStrong;
  return (
    <div>
      <p className={styles.sectionTitle}>
        <Icon name="mountain" size="sm" />
        מהחזק (למעלה) אל החלש (למטה):
      </p>
      <ol className={styles.ladder}>
        {[...words].reverse().map((w, i) => (
          <li
            key={w}
            className={styles.ladderRung}
            style={{ ['--local-rung' as string]: 1 - i / Math.max(1, words.length - 1) }}
          >
            <span className={styles.ladderNumber}>{words.length - i}</span>
            <button type="button" className={styles.synonym} onClick={() => speak(w)}>
              {displayWord(w)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RegisterBody({ item, displayWord }: { item: RegisterItem; displayWord: (w: string) => string }) {
  return (
    <div className={styles.registers}>
      {BINS.map((bin) => (
        <div key={bin} className={styles.registerColumn}>
          <p className={styles.sectionTitle}>{BIN_LABEL[bin]}</p>
          {item.register[bin].length === 0 ? (
            <p className={styles.emptyNote}>ריק בקבוצה זו</p>
          ) : (
            item.register[bin].map((w) => (
              <button key={w} type="button" className={styles.synonym} onClick={() => speak(w)}>
                {displayWord(w)}
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function ContextBody({ item }: { item: ContextItem }) {
  return (
    <blockquote className={styles.sentence}>
      <p className={styles.sectionTitle}>
        <Icon name="book" size="sm" />
        מה ההבדל?
      </p>
      <p>{item.context.explanation}</p>
    </blockquote>
  );
}

function IdiomBody({ item }: { item: IdiomItem }) {
  return (
    <>
      <div>
        <p className={styles.sectionTitle}>
          <Icon name="book" size="sm" />
          פירוש:
        </p>
        <p className={styles.meaning}>{item.idiom.meaning}</p>
      </div>
      <blockquote className={styles.sentence}>
        <p className={styles.sectionTitle}>שימוש ביומן המסע:</p>
        <ListenLine text={item.idiom.example} />
      </blockquote>
    </>
  );
}

/** A sentence with a small speaker to hear it. */
function ListenLine({ text }: { text: string }) {
  return (
    <p className={styles.listenLine}>
      <span>{text}</span>
      <button
        type="button"
        className={styles.listenButton}
        aria-label={`השמע את המשפט: ${text}`}
        onClick={() => speak(text)}
      >
        <Icon name="speaker" size="sm" />
      </button>
    </p>
  );
}
