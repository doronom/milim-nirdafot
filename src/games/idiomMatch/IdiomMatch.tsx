import { motion as m } from 'framer-motion';
import { useState } from 'react';
import { speak } from '../../audio/speak';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import type { Answer, GameProps } from '../types';
import { AlsoCorrectButton } from '../ui/AlsoCorrectButton';
import { Dots, type DotState } from '../ui/Dots';
import { Feedback } from '../ui/Feedback';
import { GuestBadge } from '../ui/GuestBadge';
import introStyles from '../ui/RoundIntro.module.css';
import type { IdiomQuestion, IdiomRound } from './build';
import styles from './IdiomMatch.module.css';

function Options({
  options,
  answer,
  chosen,
  onChoose,
  label,
}: {
  options: string[];
  answer: string;
  chosen: string | null;
  onChoose: (o: string) => void;
  label: string;
}) {
  return (
    <div className={styles.options} role="group" aria-label={label}>
      {options.map((o) => {
        const state = !chosen ? '' : o === answer ? styles.right : o === chosen ? styles.wrong : styles.faded;
        return (
          <m.button
            key={o}
            type="button"
            className={`${styles.option} ${state}`}
            onClick={() => !chosen && onChoose(o)}
            disabled={chosen !== null}
            animate={chosen === o && o !== answer ? { x: [0, -6, 6, -4, 4, 0] } : {}}
            transition={motion('feedback_shake')}
          >
            {o}
          </m.button>
        );
      })}
    </div>
  );
}

/** Idiom to meaning (or back), with a bonus: put the idiom into its example sentence. */
export function IdiomMatch({ round, onDone, onAlsoCorrect }: GameProps<IdiomRound>) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const last = index === round.questions.length - 1;
  const dots: DotState[] = round.questions.map((_, i) =>
    i < answers.length ? (answers[i]!.outcome === 'wrong' ? 'missed' : 'done') : i === index ? 'current' : 'todo',
  );
  return (
    <div className={`${styles.game} panes`}>
      <div className="pane-full">
        <Dots states={dots} label={`ביטוי ${index + 1} מתוך ${round.questions.length}`} />
      </div>
      <Step
        key={index}
        q={round.questions[index]!}
        mode={round.mode}
        last={last}
        onAnswer={(a) => setAnswers((list) => [...list, a])}
        onClaim={(word) => {
          onAlsoCorrect(round.questions[index]!.item, word);
          setAnswers((list) => list.map((x, i) => (i === list.length - 1 ? { ...x, outcome: 'also-correct' } : x)));
        }}
        onNext={(all) => (last ? onDone({ answers: all }) : setIndex(index + 1))}
        answers={answers}
      />
    </div>
  );
}

function Step({
  q,
  mode,
  last,
  answers,
  onAnswer,
  onClaim,
  onNext,
}: {
  q: IdiomQuestion;
  mode: IdiomRound['mode'];
  last: boolean;
  answers: Answer[];
  onAnswer: (a: Answer) => void;
  onClaim: (word: string) => void;
  onNext: (all: Answer[]) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  // The bonus fill-in follows a match; it is practice only and is not scored.
  const [bonus, setBonus] = useState<'off' | 'open' | 'done'>('off');
  const [bonusChosen, setBonusChosen] = useState<string | null>(null);
  const fillOnly = mode === 'fill';
  const correct = chosen === q.answer;

  const choose = (o: string) => {
    setChosen(o);
    onAnswer({ itemKey: q.item.key, outcome: o === q.answer ? 'correct' : 'wrong', chosen: o });
  };
  const continueLabel = last ? 'סיום הסבב' : 'לביטוי הבא';

  return (
    <>
      <div className="pane-prompt">
        <p className={introStyles.prompt}>
          {mode === 'meaning'
            ? 'מה פירוש הביטוי?'
            : mode === 'idiom'
              ? 'איזה ביטוי מתאים לפירוש?'
              : 'השלימו את הביטוי במשפט'}
        </p>
        {!fillOnly ? (
          <div className={styles.card}>
            {q.item.isGuest && <GuestBadge />}
            <p className={mode === 'meaning' ? styles.idiom : styles.meaning}>{q.prompt}</p>
            {mode === 'meaning' && (
              <button type="button" className={styles.listen} onClick={() => speak(q.prompt)}>
                <Icon name="speaker" size="sm" />
                האזן
              </button>
            )}
          </div>
        ) : (
          <p className={styles.sentence}>
            {q.fill.before}
            <span className={styles.blank}>{chosen ?? ' '.repeat(8)}</span>
            {q.fill.after}
          </p>
        )}
      </div>
      <div className="pane-play">
        {bonus === 'off' && (
          <Options options={q.options} answer={q.answer} chosen={chosen} onChoose={choose} label="אפשרויות" />
        )}
        {bonus !== 'off' && (
          <>
            <div className={styles.bonusTitle}>
              <Icon name="sparkle" size="sm" />
              שלב בונוס: השלימו את המשפט
            </div>
            <p className={styles.sentence}>
              {q.fill.before}
              <span className={styles.blank}>{bonusChosen ?? ' '.repeat(8)}</span>
              {q.fill.after}
            </p>
            <Options
              options={q.fill.options}
              answer={q.fill.answer}
              chosen={bonusChosen}
              onChoose={(o) => {
                setBonusChosen(o);
                setBonus('done');
              }}
              label="אפשרויות לבונוס"
            />
          </>
        )}
        {chosen && bonus === 'off' && (
          <Feedback
            correct={correct}
            title={correct ? 'מדויק!' : 'כמעט! זו התשובה'}
            formula={`${q.item.idiom.idiom} = ${q.item.idiom.meaning}`}
            extra={!correct ? <AlsoCorrectButton onClaim={() => onClaim(chosen)} /> : undefined}
            continueLabel={fillOnly ? continueLabel : 'לשלב הבונוס'}
            onContinue={() => (fillOnly ? onNext(answers) : setBonus('open'))}
          />
        )}
        {bonus === 'done' && bonusChosen && (
          <Feedback
            correct={bonusChosen === q.fill.answer}
            title={bonusChosen === q.fill.answer ? 'בונוס מדויק!' : 'כמעט! כך זה במשפט'}
            formula={`${q.fill.before}${q.fill.answer}${q.fill.after}`}
            continueLabel={continueLabel}
            onContinue={() => onNext(answers)}
          />
        )}
      </div>
    </>
  );
}
