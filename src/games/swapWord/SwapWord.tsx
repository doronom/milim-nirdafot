import { motion as m } from 'framer-motion';
import { useState } from 'react';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { useGameEnv } from '../env-context';
import type { Answer, GameProps } from '../types';
import { AlsoCorrectButton } from '../ui/AlsoCorrectButton';
import { Dots, type DotState } from '../ui/Dots';
import { Feedback } from '../ui/Feedback';
import { GuestBadge } from '../ui/GuestBadge';
import introStyles from '../ui/RoundIntro.module.css';
import { fitsSentence, type SwapRound } from './build';
import styles from './SwapWord.module.css';

/** Swap the highlighted word in a sentence for a synonym that fits; a prefix letter stays in place. */
export function SwapWord({ round, onDone, onAlsoCorrect, onReportSentence }: GameProps<SwapRound>) {
  const env = useGameEnv();
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  // By question index: a reported sentence is skipped and leaves no answer.
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [reported, setReported] = useState<number[]>([]);
  const q = round.questions[index]!;
  const last = index === round.questions.length - 1;
  const correct = checked && placed !== null && fitsSentence(q, placed);
  const answer = q.options.find((o) => fitsSentence(q, o.word))!;

  const check = () => {
    if (!placed) return;
    setChecked(true);
    setAnswers((a) => ({
      ...a,
      [index]: { itemKey: q.item.key, outcome: fitsSentence(q, placed) ? 'correct' : 'wrong', chosen: placed },
    }));
  };

  const claim = () => {
    const option = q.options.find((o) => o.word === placed);
    if (!option) return;
    onAlsoCorrect(q.item, option.word, option.nodeId);
    setAnswers((a) => ({ ...a, [index]: { ...a[index]!, outcome: 'also-correct' } }));
  };

  const advance = (all: Record<number, Answer>) => {
    if (last) {
      onDone({ answers: Object.values(all) });
      return;
    }
    setIndex(index + 1);
    setPlaced(null);
    setChecked(false);
  };
  const next = () => advance(answers);

  // "דווח על משפט": the sentence leaves play and this question is skipped without counting.
  const report = () => {
    onReportSentence(q.sentence);
    setReported((r) => [...r, index]);
    const rest = Object.fromEntries(Object.entries(answers).filter(([i]) => Number(i) !== index));
    setAnswers(rest);
    advance(rest);
  };

  const dots: DotState[] = round.questions.map((_, i) =>
    answers[i]
      ? answers[i].outcome === 'wrong'
        ? 'missed'
        : 'done'
      : reported.includes(i)
        ? 'todo'
        : i === index
          ? 'current'
          : 'todo',
  );
  const slotWord = checked && !correct ? answer.word : placed;

  return (
    <div className={styles.game}>
      <Dots states={dots} label={`משפט ${index + 1} מתוך ${round.questions.length}`} />
      <p className={introStyles.prompt}>בחרו מילה נרדפת שתחליף את המילה המודגשת</p>
      {q.item.isGuest && (
        <span className={styles.guest}>
          <GuestBadge />
        </span>
      )}
      <div className={styles.sentence} aria-live="polite">
        <span>{q.before}</span>
        <span className={styles.slotWrap}>
          {q.prefix && <span className={styles.prefix}>{q.prefix}</span>}
          <m.span
            key={`${index}-${slotWord ?? 'empty'}`}
            className={`${styles.slot} ${checked ? (correct ? styles.slotRight : styles.slotWrong) : slotWord ? styles.slotFilled : ''}`}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={motion('card_snap')}
          >
            {slotWord ? env.displayWord(slotWord) : env.displayWord(q.headword)}
            {checked && correct && <Icon name="check" size="sm" />}
          </m.span>
        </span>
        <span>{q.after}</span>
      </div>
      <div className={styles.bank} role="group" aria-label="בנק המילים">
        {q.options.map((o) => (
          <button
            key={`${index}-${o.word}`}
            type="button"
            className={`${styles.word} ${placed === o.word ? styles.chosen : ''}`}
            onClick={() => !checked && setPlaced(o.word)}
            disabled={checked}
            aria-pressed={placed === o.word}
          >
            {env.displayWord(o.word)}
          </button>
        ))}
      </div>
      {!checked && (
        <TactileButton tone="success" size="lg" block icon="check" onClick={check} disabled={!placed}>
          בדוק החלפה
        </TactileButton>
      )}
      {!q.sentence.reviewed && (
        <button type="button" className={styles.reportSentence} onClick={report}>
          <Icon name="flag" size="sm" />
          דווח על משפט
        </button>
      )}
      {checked && (
        <Feedback
          correct={correct}
          title={correct ? 'החלפה מדויקת!' : 'כמעט! זו המילה שמתאימה'}
          formula={`${env.displayWord(q.headword)} = ${env.displayWord(correct ? placed! : answer.word)}`}
          extra={!correct ? <AlsoCorrectButton key={index} onClaim={claim} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'למשפט הבא'}
          onContinue={next}
        />
      )}
    </div>
  );
}
