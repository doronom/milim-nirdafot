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
import { WordCard } from '../ui/WordCard';
import type { PickRound } from './build';
import styles from './PickSynonym.module.css';

export function PickSynonym({ round, onDone, onAlsoCorrect }: GameProps<PickRound>) {
  const { displayWord } = useGameEnv();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const question = round.questions[index]!;
  const answered = chosen !== null;
  const option = answered ? question.options[chosen]! : null;
  const correctOption = question.options.find((o) => o.correct)!;
  const last = index === round.questions.length - 1;

  const choose = (i: number) => {
    if (answered) return;
    const picked = question.options[i]!;
    setChosen(i);
    setAnswers((a) => [
      ...a,
      { itemKey: question.item.key, outcome: picked.correct ? 'correct' : 'wrong', chosen: picked.word },
    ]);
  };

  const claim = () => {
    if (!option) return;
    onAlsoCorrect(question.item, option.word, option.nodeId);
    setAnswers((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
  };

  const next = () => {
    if (last) {
      onDone({ answers });
      return;
    }
    setIndex(index + 1);
    setChosen(null);
  };

  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );

  return (
    <div className={styles.game}>
      <Dots states={dots} label={`שאלה ${index + 1} מתוך ${round.questions.length}`} />
      <p className={introStyles.prompt}>איזו מילה היא מילה נרדפת ל:</p>
      <WordCard
        word={displayWord(question.prompt)}
        hint={question.hint}
        badge={question.item.isGuest ? <GuestBadge /> : undefined}
      />
      <div className={styles.options} role="group" aria-label="אפשרויות">
        {question.options.map((o, i) => {
          const state = !answered ? 'idle' : o.correct ? 'correct' : i === chosen ? 'wrong' : 'faded';
          return (
            <m.button
              key={`${index}-${o.word}`}
              type="button"
              className={`${styles.option} ${styles[state] ?? ''}`}
              onClick={() => choose(i)}
              disabled={answered}
              aria-pressed={i === chosen}
              animate={
                state === 'wrong'
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : state === 'correct' && i === chosen
                    ? { scale: [1, 1.05, 1] }
                    : {}
              }
              transition={motion(state === 'wrong' ? 'feedback_shake' : 'feedback_burst')}
            >
              <span className={styles.number}>{i + 1}</span>
              {state === 'correct' && (
                <span className={styles.mark}>
                  <Icon name="check" size="sm" />
                </span>
              )}
              <span className={styles.word}>{displayWord(o.word)}</span>
            </m.button>
          );
        })}
      </div>
      {answered && option && (
        <Feedback
          correct={option.correct}
          title={option.correct ? 'מדויק להפליא!' : 'כמעט! הנה התשובה'}
          formula={`${displayWord(question.prompt)} = ${displayWord(correctOption.word)}`}
          extra={!option.correct ? <AlsoCorrectButton key={index} onClaim={claim} /> : undefined}
          continueLabel={last ? 'סיום הסבב' : 'לשאלה הבאה'}
          onContinue={next}
        />
      )}
    </div>
  );
}
