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
import { BIN_LABEL, BINS, type Bin, type ClassifyQuestion, type RegisterRound, type SortBoard } from './build';
import styles from './RegisterSort.module.css';

/** Sort words by register: spoken (דיבור), standard (תקני), literary (ספרותי). */
export function RegisterSort({ round, onDone, onAlsoCorrect }: GameProps<RegisterRound>) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const steps = round.mode === 'classify' ? round.questions.length : round.boards.length;
  const last = index === steps - 1;
  const next = (more: Answer[]) => {
    const all = [...answers, ...more];
    if (last) onDone({ answers: all });
    else {
      setAnswers(all);
      setIndex(index + 1);
    }
  };
  const dots: DotState[] = Array.from({ length: steps }, (_, i) =>
    i < index ? 'done' : i === index ? 'current' : 'todo',
  );
  return (
    <div className={`${styles.game} panes`}>
      <div className="pane-full">{steps > 1 && <Dots states={dots} label={`${index + 1} מתוך ${steps}`} />}</div>
      {round.mode === 'classify' ? (
        <Classify key={index} q={round.questions[index]!} last={last} onNext={next} onClaim={onAlsoCorrect} />
      ) : (
        <Sort key={index} board={round.boards[index]!} last={last} onNext={next} />
      )}
    </div>
  );
}

function Classify({
  q,
  last,
  onNext,
  onClaim,
}: {
  q: ClassifyQuestion;
  last: boolean;
  onNext: (a: Answer[]) => void;
  onClaim: GameProps<RegisterRound>['onAlsoCorrect'];
}) {
  const { displayWord } = useGameEnv();
  const [chosen, setChosen] = useState<Bin | null>(null);
  const [claimed, setClaimed] = useState(false);
  const correct = chosen === q.bin;
  return (
    <>
      <div className="pane-prompt">
        <p className={introStyles.prompt}>לאיזה משלב שייכת המילה?</p>
        <div className={styles.wordCard}>
          {q.item.isGuest && <GuestBadge />}
          <span className={styles.bigWord}>{displayWord(q.word)}</span>
          <span className={styles.meaning}>משמעות: {q.item.register.meaning}</span>
        </div>
      </div>
      <div className="pane-play">
        <div className={styles.binButtons} role="group" aria-label="משלבים">
          {BINS.map((bin) => (
            <m.button
              key={bin}
              type="button"
              className={`${styles.binButton} ${chosen && bin === q.bin ? styles.right : chosen === bin ? styles.wrong : ''}`}
              onClick={() => !chosen && setChosen(bin)}
              disabled={chosen !== null}
              animate={chosen === bin && !correct ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={motion('feedback_shake')}
            >
              {BIN_LABEL[bin]}
            </m.button>
          ))}
        </div>
        {chosen && (
          <Feedback
            correct={correct}
            title={correct ? 'בדיוק!' : 'כמעט! המשלב הנכון'}
            formula={`${displayWord(q.word)} = ${BIN_LABEL[q.bin]}`}
            extra={
              !correct ? (
                <AlsoCorrectButton
                  onClaim={() => {
                    setClaimed(true);
                    onClaim(q.item, `${q.word}: ${BIN_LABEL[chosen]}`);
                  }}
                />
              ) : undefined
            }
            continueLabel={last ? 'סיום הסבב' : 'למילה הבאה'}
            onContinue={() =>
              onNext([
                { itemKey: q.item.key, outcome: correct ? 'correct' : claimed ? 'also-correct' : 'wrong', chosen },
              ])
            }
          />
        )}
      </div>
    </>
  );
}

function Sort({ board, last, onNext }: { board: SortBoard; last: boolean; onNext: (a: Answer[]) => void }) {
  const { displayWord } = useGameEnv();
  const [placed, setPlaced] = useState<Record<string, Bin>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<Bin | null>(null);
  const bank = board.words.filter((w) => !placed[w.word]);
  const done = bank.length === 0;

  const drop = (bin: Bin) => {
    const w = board.words.find((x) => x.word === selected);
    if (!w) return;
    setSelected(null);
    if (w.bin === bin) setPlaced((p) => ({ ...p, [w.word]: bin }));
    else {
      setMissed((list) => (list.includes(w.item.key) ? list : [...list, w.item.key]));
      setFlash(bin);
      window.setTimeout(() => setFlash(null), motion('feedback_shake').duration * 1000 + 300);
    }
  };

  return (
    <>
      <div className="pane-prompt">
        <p className={introStyles.prompt}>בחרו מילה ואז את התא המתאים לה</p>
        <p className={styles.meaning}>
          {board.items.some((i) => i.isGuest) && <GuestBadge compact />}
          קבוצה: {board.items.map((i) => i.register.meaning).join(' · ')}
        </p>
      </div>
      <div className="pane-play">
        <div className={styles.bins}>
          {BINS.map((bin) => {
            const empty = board.emptyBins.includes(bin);
            return (
              <m.button
                key={bin}
                type="button"
                className={`${styles.bin} ${empty ? styles.emptyBin : ''} ${flash === bin ? styles.wrong : ''}`}
                onClick={() => selected && !empty && drop(bin)}
                disabled={empty}
                aria-label={empty ? `${BIN_LABEL[bin]}: ריק בקבוצה זו` : `תא ${BIN_LABEL[bin]}`}
                animate={flash === bin ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                transition={motion('feedback_shake')}
              >
                <span className={styles.binTitle}>{BIN_LABEL[bin]}</span>
                {empty ? (
                  <span className={styles.emptyNote}>ריק בקבוצה זו</span>
                ) : (
                  <span className={styles.binWords}>
                    {board.words
                      .filter((w) => placed[w.word] === bin)
                      .map((w) => (
                        <span key={w.word} className={styles.placed}>
                          <Icon name="check" size="sm" />
                          {displayWord(w.word)}
                        </span>
                      ))}
                  </span>
                )}
              </m.button>
            );
          })}
        </div>
        {!done && (
          <div className={styles.bank} role="group" aria-label="בנק המילים">
            {bank.map((w) => (
              <button
                key={w.word}
                type="button"
                className={`${styles.chip} ${selected === w.word ? styles.selected : ''}`}
                onClick={() => setSelected(selected === w.word ? null : w.word)}
                aria-pressed={selected === w.word}
              >
                {displayWord(w.word)}
              </button>
            ))}
          </div>
        )}
        {done && (
          <TactileButton
            tone="success"
            size="lg"
            block
            onClick={() =>
              onNext(
                board.items.map((i) => ({ itemKey: i.key, outcome: missed.includes(i.key) ? 'wrong' : 'correct' })),
              )
            }
          >
            {last ? 'סיום הסבב' : 'לקבוצה הבאה'}
          </TactileButton>
        )}
      </div>
    </>
  );
}
