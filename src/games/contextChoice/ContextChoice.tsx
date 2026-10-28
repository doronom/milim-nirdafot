import { motion as m } from 'framer-motion';
import { useState } from 'react';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { useGameEnv } from '../env-context';
import type { Answer, GameProps } from '../types';
import { AlsoCorrectButton } from '../ui/AlsoCorrectButton';
import { Dots, type DotState } from '../ui/Dots';
import { Feedback } from '../ui/Feedback';
import { GuestBadge } from '../ui/GuestBadge';
import introStyles from '../ui/RoundIntro.module.css';
import { filled, fitsContext, type ContextRound } from './build';
import styles from './ContextChoice.module.css';

/** Which word fits this sentence? After answering, the explanation from the data says why. */
export function ContextChoice({ round, onDone, onAlsoCorrect }: GameProps<ContextRound>) {
  const { displayWord } = useGameEnv();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const q = round.questions[index]!;
  const { context } = q.item;
  const last = index === round.questions.length - 1;
  const correct = chosen !== null && fitsContext(q.item, chosen);
  const sentenceMode = round.mode === 'sentence';

  const choose = (word: string) => {
    if (chosen) return;
    setChosen(word);
    setAnswers((a) => [
      ...a,
      { itemKey: q.item.key, outcome: fitsContext(q.item, word) ? 'correct' : 'wrong', chosen: word },
    ]);
  };
  const claim = () => {
    if (!chosen) return;
    onAlsoCorrect(q.item, chosen);
    setAnswers((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
  };
  const next = () => {
    if (last) onDone({ answers });
    else {
      setIndex(index + 1);
      setChosen(null);
    }
  };
  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );
  const others = context.options.filter((o) => o !== context.answer);

  return (
    <div className={`${styles.game} panes`}>
      <div className="pane-full">
        <Dots states={dots} label={`שאלה ${index + 1} מתוך ${round.questions.length}`} />
      </div>
      <div className="pane-prompt">
        <p className={introStyles.prompt}>
          {sentenceMode ? 'באיזה משפט המילה מתאימה בדיוק?' : 'איזו מילה משלימה את המשפט בצורה המדויקת ביותר?'}
        </p>
        {q.item.isGuest && (
          <span className={styles.guest}>
            <GuestBadge />
          </span>
        )}
        {!sentenceMode && (
          <p className={styles.sentence}>
            {q.before}
            <span className={`${styles.blank} ${chosen ? (correct ? styles.right : styles.wrong) : ''}`}>
              {chosen ? displayWord(chosen) : ' '.repeat(6)}
              {correct && <Icon name="check" size="sm" />}
            </span>
            {q.after}
          </p>
        )}
      </div>
      <div className="pane-play">
        <div className={sentenceMode ? styles.sentenceOptions : styles.options} role="group" aria-label="אפשרויות">
          {q.options.map((o) => {
            const state = !chosen
              ? ''
              : fitsContext(q.item, o)
                ? styles.right
                : o === chosen
                  ? styles.wrong
                  : styles.faded;
            return (
              <m.button
                key={`${index}-${o}`}
                type="button"
                className={`${sentenceMode ? styles.sentenceOption : styles.option} ${state}`}
                onClick={() => choose(o)}
                disabled={chosen !== null}
                animate={chosen === o && !fitsContext(q.item, o) ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                transition={motion('feedback_shake')}
              >
                {sentenceMode ? filled(q, displayWord(o)) : displayWord(o)}
              </m.button>
            );
          })}
        </div>
        {chosen && (
          <>
            <div className={styles.explain}>
              <p className={styles.contrast}>
                {displayWord(context.answer)} ≠ {others.map(displayWord).join(', ')}
              </p>
              <p className={styles.explainTitle}>
                <Icon name="book" size="sm" />
                למה {displayWord(context.answer)}?
              </p>
              <p>{context.explanation}</p>
            </div>
            <Feedback
              correct={correct}
              title={correct ? 'הבחנה מדויקת!' : 'כמעט! המילה המדויקת היא'}
              formula={filled(q, displayWord(context.answer))}
              extra={!correct ? <AlsoCorrectButton key={index} onClaim={claim} /> : undefined}
              continueLabel={last ? 'סיום הסבב' : 'לשאלה הבאה'}
              onContinue={next}
            />
          </>
        )}
      </div>
    </div>
  );
}
