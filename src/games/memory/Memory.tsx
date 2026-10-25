import { motion as m } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import mascot from '../../design/assets/mascot.svg';
import { motion } from '../../design/tokens';
import { TactileButton } from '../../ui/TactileButton';
import { useGameEnv } from '../env-context';
import type { Answer, GameProps } from '../types';
import introStyles from '../ui/RoundIntro.module.css';
import { cardsMatch, type MemoryRound } from './build';
import styles from './Memory.module.css';

/** How long a mismatched pair stays face up. */
const MISMATCH_VIEW_MS = 900;

/**
 * Classic memory with word pairs. A mismatch only counts against the words when both cards had been seen before:
 * discovering the board is not a mistake, forgetting a card you already saw is.
 */
export function Memory({ round, onDone }: GameProps<MemoryRound>) {
  const env = useGameEnv();
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const seen = useRef(new Set<string>());
  const missed = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const done = matched.length === round.cards.length;

  const flip = (id: string) => {
    if (open.length === 2 || open.includes(id) || matched.includes(id)) return;
    const nextOpen = [...open, id];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    const [a, b] = nextOpen.map((x) => round.cards.find((c) => c.id === x)!) as [MemoryCard, MemoryCard];
    if (cardsMatch(env, a, b)) {
      setMatched((mm) => [...mm, a.id, b.id]);
      setOpen([]);
    } else {
      if (seen.current.has(a.id) && seen.current.has(b.id)) {
        missed.current.add(a.item.key);
        missed.current.add(b.item.key);
      }
      timer.current = window.setTimeout(() => setOpen([]), MISMATCH_VIEW_MS);
    }
    seen.current.add(a.id);
    seen.current.add(b.id);
  };

  const finish = () => {
    const answers: Answer[] = round.items.map((item) => ({
      itemKey: item.key,
      outcome: missed.current.has(item.key) ? 'wrong' : 'correct',
    }));
    onDone({ answers });
  };

  const columns = round.cards.length > 12 ? 4 : 3;
  return (
    <div className={styles.game}>
      <p className={introStyles.prompt}>מצאו את הזוגות של מילים נרדפות</p>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {round.cards.map((c, i) => {
          const faceUp = open.includes(c.id) || matched.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`${styles.card} ${faceUp ? styles.up : ''} ${matched.includes(c.id) ? styles.matched : ''}`}
              onClick={() => flip(c.id)}
              aria-label={faceUp ? env.displayWord(c.word) : `קלף ${i + 1}, הפוך`}
            >
              {/* Each face turns in from edge-on, so the text is never shown mirrored mid-flip. */}
              <m.span
                key={faceUp ? 'front' : 'back'}
                className={styles.face}
                initial={{ rotateY: 90 }}
                animate={{ rotateY: 0 }}
                transition={motion('card_flip')}
              >
                {faceUp ? (
                  <span className={styles.word}>{env.displayWord(c.word)}</span>
                ) : (
                  <img src={mascot} alt="" className={styles.back} />
                )}
              </m.span>
            </button>
          );
        })}
      </div>
      {done && (
        <TactileButton tone="success" size="lg" block onClick={finish}>
          סיום הסבב
        </TactileButton>
      )}
    </div>
  );
}

type MemoryCard = MemoryRound['cards'][number];
