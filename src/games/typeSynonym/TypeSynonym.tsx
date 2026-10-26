import { useState } from 'react';
import { judgeTyped, type TypedVerdict } from '../../content/typing';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { useGameEnv } from '../env-context';
import type { Answer, GameProps } from '../types';
import { AlsoCorrectButton } from '../ui/AlsoCorrectButton';
import { Dots, type DotState } from '../ui/Dots';
import { Feedback } from '../ui/Feedback';
import { GuestBadge } from '../ui/GuestBadge';
import { HebrewKeyboard } from '../ui/HebrewKeyboard';
import introStyles from '../ui/RoundIntro.module.css';
import { WordCard } from '../ui/WordCard';
import type { TypeRound } from './build';
import styles from './TypeSynonym.module.css';

/** Type a synonym on the on-screen keyboard. Final letters and one-letter slips are forgiven. */
export function TypeSynonym({ round, onDone, onAlsoCorrect }: GameProps<TypeRound>) {
  const { displayWord } = useGameEnv();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<TypedVerdict | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const q = round.questions[index]!;
  const last = index === round.questions.length - 1;
  const right = verdict !== null && verdict.kind !== 'wrong';

  const check = () => {
    const v = judgeTyped(typed, q.accepted, round.vocabulary);
    setVerdict(v);
    // A tolerated slip is not a mistake, but it does not move the word up a box either.
    const outcome = v.kind === 'exact' ? 'correct' : v.kind === 'typo' ? 'near-miss' : 'wrong';
    setAnswers((a) => [...a, { itemKey: q.item.key, outcome, chosen: typed }]);
  };
  const claim = () => {
    onAlsoCorrect(q.item, typed.trim(), typed.trim());
    setAnswers((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
  };
  const next = () => {
    if (last) onDone({ answers });
    else {
      setIndex(index + 1);
      setTyped('');
      setVerdict(null);
    }
  };
  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );
  const edit = (f: (t: string) => string) => verdict === null && setTyped(f);

  return (
    <div className={styles.game}>
      <Dots states={dots} label={`מילה ${index + 1} מתוך ${round.questions.length}`} />
      <WordCard word={displayWord(q.prompt)} hint={q.hint} badge={q.item.isGuest ? <GuestBadge /> : undefined} />
      <p className={introStyles.prompt}>הקלידו מילה נרדפת:</p>
      <div
        className={`${styles.field} ${verdict ? (right ? styles.ok : styles.bad) : ''}`}
        aria-live="polite"
        aria-label="התשובה שהוקלדה"
      >
        {typed ? (
          <span className={styles.typed}>{typed}</span>
        ) : (
          <span className={styles.placeholder}>המילה שלכם תופיע כאן</span>
        )}
        {!verdict && typed && (
          <button type="button" className={styles.clear} onClick={() => setTyped('')} aria-label="נקה">
            <Icon name="refresh" size="sm" />
          </button>
        )}
      </div>
      {!verdict && (
        <>
          <HebrewKeyboard
            onKey={(k) => edit((t) => t + k)}
            onBackspace={() => edit((t) => t.slice(0, -1))}
            onSpace={() => edit((t) => (t.endsWith(' ') || t === '' ? t : `${t} `))}
          />
          <TactileButton block size="lg" icon="check" onClick={check} disabled={typed.trim() === ''}>
            בדיקת תשובה
          </TactileButton>
        </>
      )}
      {verdict && (
        <Feedback
          correct={right}
          title={
            verdict.kind === 'exact'
              ? 'מדויק!'
              : verdict.kind === 'typo'
                ? 'כמעט! בדוק את האיות'
                : 'עוד לא. הנה מילים נרדפות'
          }
          formula={
            verdict.kind === 'wrong'
              ? `${displayWord(q.prompt)} = ${q.item.entry.synonyms.map(displayWord).join(', ')}`
              : `${displayWord(q.prompt)} = ${displayWord(verdict.word)}`
          }
          extra={verdict.kind === 'wrong' ? <AlsoCorrectButton key={index} onClaim={claim} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'למילה הבאה'}
          onContinue={next}
        />
      )}
    </div>
  );
}
