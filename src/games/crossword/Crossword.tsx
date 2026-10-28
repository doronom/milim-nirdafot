import { useState } from 'react';
import { useLandscape } from '../../design/layout';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import type { GameProps } from '../types';
import { GuestBadge } from '../ui/GuestBadge';
import introStyles from '../ui/RoundIntro.module.css';
import type { CrosswordRound } from './build';
import { wordCells, type CrossWord } from './generate';
import styles from './Crossword.module.css';

const at = (r: number, c: number) => `${r}:${c}`;

/**
 * Mini crossword filled from a letter-tile bank (no system keyboard). Pick a clue, tap tiles to fill its cells, then
 * check the word. Revealing a word solves it but counts it as not known.
 */
export function Crossword({ round, onDone }: GameProps<CrosswordRound>) {
  const landscape = useLandscape();
  const { puzzle } = round;
  const [selected, setSelected] = useState(puzzle.words[0]!.itemKey);
  const [letters, setLetters] = useState<Record<string, string>>({});
  const [solved, setSolved] = useState<Record<string, 'solved' | 'revealed'>>({});
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const word = puzzle.words.find((w) => w.itemKey === selected)!;
  const cells = wordCells(word);
  const locked = new Set(
    puzzle.words.filter((w) => solved[w.itemKey]).flatMap((w) => wordCells(w).map((c) => at(c.row, c.col))),
  );
  const done = puzzle.words.every((w) => solved[w.itemKey]);
  const full = cells.every((c) => letters[at(c.row, c.col)]);
  const numbers = new Map(puzzle.words.map((w) => [at(w.row, w.col), w.number]));
  const inSelected = new Set(cells.map((c) => at(c.row, c.col)));

  const type = (ch: string) => {
    const free = cells.find((c) => !letters[at(c.row, c.col)] && !locked.has(at(c.row, c.col)));
    if (free) setLetters((l) => ({ ...l, [at(free.row, free.col)]: ch }));
  };
  const erase = () => {
    const last = [...cells].reverse().find((c) => letters[at(c.row, c.col)] && !locked.has(at(c.row, c.col)));
    if (last) setLetters((l) => Object.fromEntries(Object.entries(l).filter(([k]) => k !== at(last.row, last.col))));
  };
  const clear = () =>
    setLetters((l) => Object.fromEntries(Object.entries(l).filter(([k]) => locked.has(k) || !inSelected.has(k))));
  const nextUnsolved = (after: Record<string, unknown>) =>
    puzzle.words.find((w) => !after[w.itemKey] && w.itemKey !== selected);
  const check = () => {
    if (cells.every((c) => letters[at(c.row, c.col)] === c.ch)) {
      const after = { ...solved, [selected]: 'solved' as const };
      setSolved(after);
      const next = nextUnsolved(after);
      if (next) setSelected(next.itemKey);
    } else {
      setMissed((m) => (m.includes(selected) ? m : [...m, selected]));
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
    }
  };
  const reveal = () => {
    setLetters((l) => ({ ...l, ...Object.fromEntries(cells.map((c) => [at(c.row, c.col), c.ch])) }));
    const after = { ...solved, [selected]: 'revealed' as const };
    setSolved(after);
    const next = nextUnsolved(after);
    if (next) setSelected(next.itemKey);
  };
  const finish = () =>
    onDone({
      answers: puzzle.words.map((w) => ({
        itemKey: w.itemKey,
        outcome: solved[w.itemKey] === 'solved' && !missed.includes(w.itemKey) ? 'correct' : 'wrong',
      })),
    });

  const clueLabel = (w: CrossWord) => `${w.number} ${w.direction === 'across' ? 'מאוזן' : 'מאונך'}`;

  const current = (
    <div className={styles.current}>
      <span className={styles.clueTag}>
        {clueLabel(word)} · {word.answer.length} אותיות
      </span>
      <span className={styles.clueText}>
        {round.items[word.itemKey]?.isGuest && <GuestBadge compact />}
        {word.clue}
      </span>
    </div>
  );
  const board = (
    <div
      className={`${styles.grid} ${flash ? styles.flash : ''}`}
      style={{
        gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
        ['--local-cols' as string]: puzzle.cols,
        ['--local-rows' as string]: puzzle.rows,
      }}
      role="grid"
      aria-label="לוח התשבץ"
    >
      {puzzle.cells.map((row, r) =>
        row.map((ch, c) => {
          const k = at(r, c);
          if (ch === null) return <span key={k} className={styles.block} aria-hidden />;
          const state = locked.has(k) ? styles.locked : inSelected.has(k) ? styles.active : '';
          return (
            <button
              key={k}
              type="button"
              className={`${styles.cell} ${state}`}
              onClick={() => {
                const owner = puzzle.words.find(
                  (w) => !solved[w.itemKey] && wordCells(w).some((x) => at(x.row, x.col) === k),
                );
                if (owner) setSelected(owner.itemKey);
              }}
              aria-label={letters[k] ?? 'משבצת ריקה'}
            >
              {numbers.has(k) && <span className={styles.number}>{numbers.get(k)}</span>}
              {letters[k] ?? ''}
            </button>
          );
        }),
      )}
    </div>
  );
  const clueList = (
    <ul className={styles.clues} aria-label="הגדרות">
      {puzzle.words.map((w) => (
        <li key={w.itemKey}>
          <button
            type="button"
            className={`${styles.clue} ${w.itemKey === selected ? styles.clueSelected : ''} ${solved[w.itemKey] ? styles.clueDone : ''}`}
            onClick={() => !solved[w.itemKey] && setSelected(w.itemKey)}
            disabled={Boolean(solved[w.itemKey])}
          >
            {solved[w.itemKey] === 'solved' && <Icon name="check" size="sm" />}
            <span className={styles.clueNumber}>{clueLabel(w)}</span>
            {w.clue}
          </button>
        </li>
      ))}
    </ul>
  );
  const input = (
    <>
      {done ? (
        <TactileButton tone="success" size="lg" block onClick={finish}>
          סיום הסבב
        </TactileButton>
      ) : (
        <>
          <p className={introStyles.prompt}>בחרו אותיות למילה</p>
          <div className={styles.tiles} role="group" aria-label="אריחי אותיות">
            {round.tiles[selected]!.map((ch, i) => (
              <button key={`${selected}-${i}`} type="button" className={styles.tile} onClick={() => type(ch)}>
                {ch}
              </button>
            ))}
          </div>
          <div className={styles.tools}>
            <TactileButton tone="quiet" onClick={erase}>
              מחק
            </TactileButton>
            <TactileButton tone="quiet" onClick={clear}>
              נקה
            </TactileButton>
            <TactileButton tone="quiet" icon="sparkle" onClick={reveal}>
              גלה מילה
            </TactileButton>
          </div>
          <TactileButton tone="success" size="lg" block icon="check" onClick={check} disabled={!full}>
            בדוק מילה
          </TactileButton>
        </>
      )}
    </>
  );
  // Landscape: the clue and letter tiles beside the board and clue list; portrait: one stack.
  return landscape ? (
    <div className={`${styles.game} panes`}>
      <div className="pane-prompt">
        {current}
        {input}
      </div>
      <div className="pane-play">
        {board}
        {clueList}
      </div>
    </div>
  ) : (
    <div className={styles.game}>
      {current}
      {board}
      {clueList}
      {input}
    </div>
  );
}
