import { motion as m } from 'framer-motion';
import { useState } from 'react';
import { speak } from '../../audio/speak';
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
import { isOrdered, isStronger, type LadderRound, type OrderQuestion, type StrongerQuestion } from './build';
import styles from './IntensityLadder.module.css';

/** Order words from weak to strong on a ladder, or pick the stronger of two. */
export function IntensityLadder({ round, onDone, onAlsoCorrect }: GameProps<LadderRound>) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const total = round.questions.length;
  const last = index === total - 1;
  const record = (a: Answer) => setAnswers((list) => [...list, a]);
  const claim = (word: string) => {
    const q = round.questions[index]!;
    onAlsoCorrect(q.item, word);
    setAnswers((list) => list.map((x, i) => (i === list.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
  };
  const next = () => (last ? onDone({ answers }) : setIndex(index + 1));
  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );

  return (
    <div className={styles.game}>
      <Dots states={dots} label={`שאלה ${index + 1} מתוך ${total}`} />
      {round.mode === 'stronger' ? (
        <Stronger key={index} q={round.questions[index]!} last={last} onAnswer={record} onClaim={claim} onNext={next} />
      ) : (
        <Order key={index} q={round.questions[index]!} last={last} onAnswer={record} onClaim={claim} onNext={next} />
      )}
    </div>
  );
}

interface StepProps<Q> {
  q: Q;
  last: boolean;
  onAnswer: (a: Answer) => void;
  onClaim: (word: string) => void;
  onNext: () => void;
}

function Stronger({ q, last, onAnswer, onClaim, onNext }: StepProps<StrongerQuestion>) {
  const { displayWord } = useGameEnv();
  const [chosen, setChosen] = useState<string | null>(null);
  const weaker = q.pair.find((w) => w !== q.stronger)!;
  const choose = (w: string) => {
    if (chosen) return;
    setChosen(w);
    onAnswer({ itemKey: q.item.key, outcome: isStronger(q, w) ? 'correct' : 'wrong', chosen: w });
  };
  return (
    <>
      <p className={introStyles.prompt}>איזו מילה חזקה יותר?</p>
      <p className={styles.theme}>
        {q.item.isGuest && <GuestBadge compact />}
        {q.item.scale.theme}
      </p>
      <div className={styles.pair} role="group" aria-label="שתי מילים">
        {q.pair.map((w) => {
          const state = !chosen ? '' : w === q.stronger ? styles.right : w === chosen ? styles.wrong : '';
          return (
            <m.button
              key={w}
              type="button"
              className={`${styles.card} ${state}`}
              onClick={() => choose(w)}
              disabled={chosen !== null}
              animate={chosen === w && w !== q.stronger ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={motion('feedback_shake')}
            >
              {displayWord(w)}
            </m.button>
          );
        })}
      </div>
      {chosen && (
        <Feedback
          correct={isStronger(q, chosen)}
          title={isStronger(q, chosen) ? 'נכון! זו המילה החזקה' : 'כמעט! המילה החזקה היא'}
          formula={`${displayWord(weaker)} < ${displayWord(q.stronger)}`}
          extra={!isStronger(q, chosen) ? <AlsoCorrectButton onClaim={() => onClaim(chosen)} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'לשאלה הבאה'}
          onContinue={onNext}
        />
      )}
    </>
  );
}

function Order({ q, last, onAnswer, onClaim, onNext }: StepProps<OrderQuestion>) {
  const { displayWord } = useGameEnv();
  // Rungs fill from the bottom (weakest) up; tapping a placed word sends it back to the bank.
  const [placed, setPlaced] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const full = placed.length === q.order.length;
  const correct = checked && isOrdered(q, placed);
  const bank = q.bank.filter((w) => !placed.includes(w));
  const check = () => {
    setChecked(true);
    onAnswer({ itemKey: q.item.key, outcome: isOrdered(q, placed) ? 'correct' : 'wrong', chosen: placed.join(' < ') });
  };
  const rungs = q.order.map((_, i) => i).reverse();
  return (
    <>
      <p className={introStyles.prompt}>סדרו מהחלש אל החזק ביותר</p>
      <p className={styles.theme}>
        {q.item.isGuest && <GuestBadge compact />}
        {q.item.scale.theme}
      </p>
      <ol className={styles.ladder} aria-label="הסולם, מהחזק (למעלה) אל החלש (למטה)">
        {rungs.map((i) => {
          const word = checked && !correct ? q.order[i] : placed[i];
          const state = !checked ? '' : correct || placed[i] === q.order[i] ? styles.right : styles.wrong;
          return (
            <li
              key={i}
              className={`${styles.rung} ${state}`}
              style={{ ['--local-rung' as string]: i / Math.max(1, q.order.length - 1) }}
            >
              <span className={styles.rungNumber}>{i + 1}</span>
              {word ? (
                <button
                  type="button"
                  className={styles.rungWord}
                  disabled={checked}
                  onClick={() => setPlaced(placed.slice(0, i))}
                  aria-label={`${displayWord(word)}, שלב ${i + 1}`}
                >
                  {displayWord(word)}
                  {checked && (correct || placed[i] === q.order[i]) && <Icon name="check" size="sm" />}
                </button>
              ) : (
                <span className={styles.empty}>{i === placed.length ? 'הבא בתור' : ''}</span>
              )}
            </li>
          );
        })}
      </ol>
      {!checked && (
        <div className={styles.bank} role="group" aria-label="בנק המילים">
          {bank.map((w) => (
            <button
              key={w}
              type="button"
              className={styles.chip}
              onClick={() => {
                speak(w);
                setPlaced([...placed, w]);
              }}
            >
              {displayWord(w)}
            </button>
          ))}
        </div>
      )}
      {!checked && (
        <TactileButton block size="lg" icon="check" onClick={check} disabled={!full}>
          בדוק דירוג
        </TactileButton>
      )}
      {checked && (
        <Feedback
          correct={correct}
          title={correct ? 'דירוג מדויק!' : 'כמעט! זה הסדר הנכון'}
          formula={q.order.map(displayWord).join(' < ')}
          extra={!correct ? <AlsoCorrectButton onClaim={() => onClaim(placed.join(' < '))} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'לסולם הבא'}
          onContinue={onNext}
        />
      )}
    </>
  );
}
