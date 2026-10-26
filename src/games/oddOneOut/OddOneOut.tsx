import { AnimatePresence, motion as m, useReducedMotion } from 'framer-motion';
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
import { isIntruder, type OddRound } from './build';
import styles from './OddOneOut.module.css';

/** Four floating bubbles; pop the one word that is not a synonym of the others. */
export function OddOneOut({ round, onDone, onAlsoCorrect }: GameProps<OddRound>) {
  const env = useGameEnv();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [popped, setPopped] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const question = round.questions[index]!;
  const answered = popped !== null;
  const correct = answered && isIntruder(env, question, popped);
  const intruder = question.bubbles.find((b) => b.intruder)!;
  const synonyms = question.bubbles.filter((b) => !b.intruder);
  const last = index === round.questions.length - 1;
  // Each bubble floats at a slightly different pace so they never bob in sync.
  const float = motion('ambient_float');

  const pop = (word: string) => {
    if (answered) return;
    setPopped(word);
    const ok = isIntruder(env, question, word);
    setAnswers((a) => [...a, { itemKey: question.item.key, outcome: ok ? 'correct' : 'wrong', chosen: word }]);
  };

  // The child popped a synonym, so the real intruder stayed: claiming "also correct" says the intruder belongs too.
  const claim = () => {
    onAlsoCorrect(question.item, intruder.word, intruder.nodeId);
    setAnswers((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
  };

  const next = () => {
    if (last) {
      onDone({ answers });
      return;
    }
    setIndex(index + 1);
    setPopped(null);
  };

  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );

  return (
    <div className={styles.game}>
      <Dots states={dots} label={`שאלה ${index + 1} מתוך ${round.questions.length}`} />
      <p className={introStyles.prompt}>איזו מילה אינה שייכת לקבוצה?</p>
      <p className={styles.sub}>פוצצו את הבועה של המילה שאינה נרדפת לשאר</p>
      {question.item.isGuest && (
        <span className={styles.guest}>
          <GuestBadge />
        </span>
      )}
      <div className={styles.field} role="group" aria-label="בועות">
        <AnimatePresence>
          {question.bubbles.map((b, i) => {
            const isPopped = popped === b.word;
            const reveal = answered && (b.intruder || isPopped);
            const state = !answered
              ? 'idle'
              : b.intruder
                ? isPopped
                  ? 'hit'
                  : 'missedIntruder'
                : isPopped
                  ? 'wrongPop'
                  : 'safe';
            return (
              <m.button
                key={`${index}-${b.word}`}
                type="button"
                className={`${styles.bubble} ${styles[state] ?? ''}`}
                onClick={() => pop(b.word)}
                disabled={answered}
                aria-label={
                  reveal ? `${env.displayWord(b.word)}${b.intruder ? ', הפולש' : ''}` : env.displayWord(b.word)
                }
                initial={{ scale: 0.6, opacity: 0 }}
                animate={
                  isPopped && b.intruder
                    ? { scale: [1, 1.25, 0.9], opacity: [1, 1, 0.85] }
                    : reduced || answered
                      ? { scale: 1, opacity: 1, y: 0 }
                      : { scale: 1, opacity: 1, y: [0, -6, 0] }
                }
                transition={
                  isPopped
                    ? motion('bubble_pop')
                    : reduced || answered
                      ? motion('bubble_pop')
                      : {
                          y: { ...float, duration: float.duration * (1 + i * 0.12), repeat: Infinity },
                          ...motion('bubble_pop'),
                        }
                }
              >
                {state === 'hit' && <Icon name="check" size="sm" />}
                <span className={state === 'hit' ? styles.struck : undefined}>{env.displayWord(b.word)}</span>
                {answered && b.intruder && <span className={styles.tag}>הפולש</span>}
              </m.button>
            );
          })}
        </AnimatePresence>
      </div>
      {answered && (
        <Feedback
          correct={correct}
          title={correct ? 'פיצוץ מדויק!' : 'כמעט! זה היה הפולש'}
          formula={`${synonyms.map((b) => env.displayWord(b.word)).join(', ')} | הפולש: ${env.displayWord(intruder.word)}`}
          extra={!correct ? <AlsoCorrectButton key={index} onClaim={claim} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'לשאלה הבאה'}
          onContinue={next}
        />
      )}
    </div>
  );
}
