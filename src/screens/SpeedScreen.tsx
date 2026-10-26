import { motion as m } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { content, displayWord, graph, links } from '../app/data';
import { trapKeys } from '../engine/distractors';
import { dayKey } from '../engine/dates';
import { isWorldUnlocked, markPlayed, recordSpeedRun, speedAvailable } from '../engine/progress';
import { motion } from '../design/tokens';
import {
  buildSpeedQuestions,
  comboFor,
  emptyTally,
  SPEED_SECONDS,
  tallyAnswer,
  type SpeedTally,
} from '../games/speedChallenge/speed';
import type { GameEnv } from '../games/types';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { Pill } from '../ui/Pill';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import styles from './SpeedScreen.module.css';

type Phase = 'intro' | 'play' | 'done';

/** Opt-in 60-second challenge of quick pick-the-synonym questions, with a combo and a personal best. */
export function SpeedScreen() {
  const navigate = useNavigate();
  const { progress, loaded, update } = useProgress();
  const [phase, setPhase] = useState<Phase>('intro');
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [left, setLeft] = useState(SPEED_SECONDS);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<SpeedTally>(emptyTally);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const [newBest, setNewBest] = useState(false);

  const env: GameEnv = useMemo(
    () => ({
      content,
      sentences: { reviewedOnly: false, blocked: new Set() },
      graph,
      links,
      pool: content.entries,
      decisions: { confirmedTraps: trapKeys(content.notSynonyms) },
      displayWord,
    }),
    [],
  );
  // Words from the worlds the child has reached (booklet and extra entries).
  const entries = useMemo(
    () => content.entries.filter((e) => e.source !== 'custom' && (e.difficulty === 1 || isWorldUnlocked(progress, 2))),
    [progress],
  );
  const questions = useMemo(() => buildSpeedQuestions(env, entries, seed), [env, entries, seed]);

  // The latest tally and the best score at the start, for ending the run from the timer callback.
  const tallyRef = useRef<SpeedTally>(emptyTally);
  const bestAtStart = useRef<number | null>(null);
  const endRun = useCallback(() => {
    const t = tallyRef.current;
    const run = { score: t.score, correct: t.correct, at: new Date().toISOString() };
    setNewBest(bestAtStart.current === null || run.score > bestAtStart.current);
    update((p) => markPlayed(recordSpeedRun(p, run), dayKey()));
    setPhase('done');
  }, [update]);

  useEffect(() => {
    if (phase !== 'play') return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, SPEED_SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        endRun();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, endRun]);

  if (!loaded) return null;
  if (!speedAvailable(progress)) return <Navigate to="/adventure" replace />;

  const start = () => {
    setSeed(String(Date.now()));
    setIndex(0);
    setTally(emptyTally);
    tallyRef.current = emptyTally;
    bestAtStart.current = progress.speedBest?.score ?? null;
    setLeft(SPEED_SECONDS);
    setPhase('play');
  };
  const answer = (correct: boolean) => {
    if (flash) return;
    setTally((t) => tallyAnswer(t, correct));
    setFlash(correct ? 'right' : 'wrong');
    window.setTimeout(
      () => {
        setFlash(null);
        setIndex((i) => i + 1);
      },
      motion('feedback_burst').duration * 1000,
    );
  };
  const q = questions[index];

  return (
    <div data-world={4} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה" onClick={() => navigate('/adventure')}>
            <Icon name="back" />
          </IconButton>
        }
        title={
          <>
            <Icon name="bolt" />
            אתגר מהירות
          </>
        }
        end={
          progress.speedBest ? (
            <Pill tone="xp" icon="trophy">
              {progress.speedBest.score}
            </Pill>
          ) : undefined
        }
      />
      <main className={styles.body}>
        {phase === 'intro' && (
          <>
            <MascotBubble>
              60 שניות, כמה שיותר מילים נרדפות. תשובות נכונות ברצף מכפילות את הניקוד. אין פסילות!
            </MascotBubble>
            {progress.speedBest && <p className={styles.best}>השיא שלכם: {progress.speedBest.score} נקודות</p>}
            <TactileButton block size="lg" icon="bolt" onClick={start}>
              מתחילים
            </TactileButton>
          </>
        )}
        {phase === 'play' && q && (
          <>
            <div className={styles.hud}>
              <div
                className={styles.timer}
                role="timer"
                aria-label={`${left} שניות נותרו`}
                style={{ ['--local-progress' as string]: left / SPEED_SECONDS }}
              >
                <span>{left}</span>
              </div>
              <div className={styles.stats}>
                <span className={styles.score}>{tally.score}</span>
                <span className={styles.combo}>קומבו x{comboFor(tally.streak)}</span>
              </div>
            </div>
            <m.p
              key={index}
              className={`${styles.word} ${flash ? styles[flash] : ''}`}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={motion('card_snap')}
            >
              {displayWord(q.prompt)}
            </m.p>
            <div className={styles.options} role="group" aria-label="אפשרויות">
              {q.options.map((o) => (
                <button
                  key={`${index}-${o.word}`}
                  type="button"
                  className={styles.option}
                  onClick={() => answer(o.correct)}
                >
                  {displayWord(o.word)}
                </button>
              ))}
            </div>
          </>
        )}
        {phase === 'done' && (
          <div className={styles.done}>
            {newBest && (
              <Pill tone="xp" icon="trophy">
                שיא אישי חדש!
              </Pill>
            )}
            <p className={styles.final}>{tally.score}</p>
            <p className={styles.best}>
              {tally.correct} תשובות נכונות מתוך {tally.answered}
            </p>
            <TactileButton block size="lg" icon="refresh" onClick={start}>
              עוד סיבוב
            </TactileButton>
            <TactileButton block tone="quiet" icon="back" to="/adventure">
              חזרה להרפתקה
            </TactileButton>
          </div>
        )}
      </main>
    </div>
  );
}
