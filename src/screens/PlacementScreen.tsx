import { useState } from 'react';
import { useNavigate } from 'react-router';
import { createRng } from '../engine/rng';
import { unlockWorld } from '../engine/progress';
import { GameEnvContext } from '../games/env-context';
import { buildPickRound } from '../games/pickSynonym/build';
import { PickSynonym } from '../games/pickSynonym/PickSynonym';
import { buildPlacement, placementUnlocks } from '../games/session';
import type { RoundResult } from '../games/types';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import styles from './LevelScreen.module.css';

const DIFFICULTY = { tier: 2 as const, options: 4 as const };

/**
 * The onboarding placement challenge: 20 words across difficulties. 85% on the difficulty-1 words opens World 2.
 * It only decides where to start; it does not touch the Leitner boxes.
 */
export function PlacementScreen() {
  const { content, freePlay: env } = useGameData();
  const navigate = useNavigate();
  const { update } = useProgress();
  const [seed] = useState(() => String(Date.now()));
  const [result, setResult] = useState<{ unlocked: boolean; correct: number; total: number } | null>(null);
  const [placement] = useState(() => buildPlacement(content.entries, seed));
  const [round] = useState(() =>
    buildPickRound(
      env,
      placement.items.filter((i) => i.kind === 'pair'),
      DIFFICULTY,
      createRng(`${seed}:pick`),
    ),
  );

  const done = ({ answers }: RoundResult) => {
    const unlocked = placementUnlocks(answers, placement.easyKeys);
    update((p) => {
      const onboarded = { ...p, onboarded: true };
      return unlocked ? unlockWorld(onboarded, 2) : onboarded;
    });
    setResult({ unlocked, correct: answers.filter((a) => a.outcome !== 'wrong').length, total: answers.length });
  };

  return (
    <GameEnvContext.Provider value={env}>
      <div data-world={1} className={styles.screen}>
        <TopBar
          start={
            <IconButton label="חזרה" onClick={() => navigate('/welcome')}>
              <Icon name="back" />
            </IconButton>
          }
          title="אתגר מיון"
          subtitle="20 שאלות"
        />
        <main className={styles.body}>
          {!result ? (
            <PickSynonym
              round={round}
              difficulty={DIFFICULTY}
              stage="recognition"
              onDone={done}
              onAlsoCorrect={() => undefined}
              onReportSentence={() => undefined}
            />
          ) : (
            <>
              <MascotBubble>
                {result.unlocked
                  ? `${result.correct} מתוך ${result.total}! פתחתם את יער ההרחבה. אפשר להתחיל משם או לעבור קודם בנמל.`
                  : `${result.correct} מתוך ${result.total}. נתחיל יחד מנמל היסודות, שם המסע מתחיל.`}
              </MascotBubble>
              <TactileButton block size="lg" icon="compass" onClick={() => navigate('/', { replace: true })}>
                למפת העולמות
              </TactileButton>
            </>
          )}
        </main>
      </div>
    </GameEnvContext.Provider>
  );
}
