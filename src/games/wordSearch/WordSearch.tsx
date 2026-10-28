import { useRef, useState, type PointerEvent } from 'react';
import { useLandscape } from '../../design/layout';
import { TactileButton } from '../../ui/TactileButton';
import { Icon } from '../../ui/Icon';
import { useGameEnv } from '../env-context';
import type { GameProps } from '../types';
import { GuestBadge } from '../ui/GuestBadge';
import introStyles from '../ui/RoundIntro.module.css';
import type { WordSearchRound } from './build';
import { matchSelection, selectionCells, type Cell } from './generate';
import styles from './WordSearch.module.css';

const key = (c: Cell) => `${c.row}:${c.col}`;

function cellAt(x: number, y: number): Cell | null {
  const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-row]');
  return el ? { row: Number(el.dataset.row), col: Number(el.dataset.col) } : null;
}

/**
 * Find the hidden synonyms: drag from the first letter to the last, right-to-left or top-down (or tap the first
 * letter, then the last). "Show me one" reveals a word, which then counts as not known.
 */
export function WordSearch({ round, onDone }: GameProps<WordSearchRound>) {
  const env = useGameEnv();
  const landscape = useLandscape();
  const { grid } = round;
  const [found, setFound] = useState<Record<string, 'found' | 'revealed'>>({});
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [miss, setMiss] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);

  const foundSet = new Set(Object.keys(found));
  const done = foundSet.size === grid.words.length;
  const selection = anchor && hover ? selectionCells(anchor, hover) : anchor ? [anchor] : null;
  const selected = new Set((selection ?? []).map(key));
  const owner = new Map<string, string>();
  for (const w of grid.words) if (found[w.itemKey]) for (const c of w.cells) owner.set(key(c), found[w.itemKey]!);

  const finishSelection = (a: Cell, b: Cell) => {
    const cells = selectionCells(a, b);
    const word = cells && cells.length > 1 ? matchSelection(grid, cells, foundSet) : null;
    if (word) setFound((f) => ({ ...f, [word.itemKey]: 'found' }));
    else if (cells && cells.length > 1) {
      setMiss(true);
      window.setTimeout(() => setMiss(false), 600);
    }
    setAnchor(null);
    setHover(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    moved.current = false;
    // Second tap of tap-tap selection.
    if (anchor && !(anchor.row === cell.row && anchor.col === cell.col)) {
      finishSelection(anchor, cell);
      dragging.current = false;
      return;
    }
    setAnchor(cell);
    setHover(cell);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !anchor) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell && key(cell) !== key(hover ?? anchor)) {
      moved.current = true;
      setHover(cell);
    }
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    // A drag ends the selection; a plain tap leaves the first letter marked for tap-tap selection.
    if (moved.current && anchor && hover) finishSelection(anchor, hover);
  };

  const reveal = () => {
    const next = grid.words.find((w) => !found[w.itemKey]);
    if (next) setFound((f) => ({ ...f, [next.itemKey]: 'revealed' }));
  };

  const finish = () =>
    onDone({
      answers: grid.words.map((w) => ({
        itemKey: w.itemKey,
        outcome: found[w.itemKey] === 'found' ? 'correct' : 'wrong',
      })),
    });

  const prompt = (
    <p className={introStyles.prompt}>מצאו {grid.words.length} מילים נרדפות (מימין לשמאל ומלמעלה למטה בלבד)</p>
  );
  const board = (
    <div
      className={`${styles.grid} ${miss ? styles.miss : ''}`}
      style={{ gridTemplateColumns: `repeat(${grid.size}, 1fr)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="grid"
      aria-label="לוח התפזורת"
    >
      {grid.rows.map((row, r) =>
        row.map((letter, c) => {
          const k = `${r}:${c}`;
          const state = selected.has(k)
            ? styles.selecting
            : owner.get(k) === 'found'
              ? styles.found
              : owner.get(k) === 'revealed'
                ? styles.revealed
                : '';
          return (
            <span
              key={k}
              className={`${styles.cell} ${state}`}
              data-row={r}
              data-col={c}
              role="gridcell"
              aria-label={letter}
            >
              {letter}
            </span>
          );
        }),
      )}
    </div>
  );
  const list = (
    <>
      <ul className={styles.words} aria-label="המילים לחיפוש">
        {grid.words.map((w) => (
          <li
            key={w.itemKey}
            className={`${styles.word} ${found[w.itemKey] === 'found' ? styles.wordDone : found[w.itemKey] === 'revealed' ? styles.wordRevealed : ''}`}
          >
            {found[w.itemKey] === 'found' && <Icon name="check" size="sm" />}
            <span className={found[w.itemKey] ? styles.struck : undefined}>{env.displayWord(w.word)}</span>
            {round.items[w.itemKey]?.isGuest && <GuestBadge compact />}
          </li>
        ))}
      </ul>
      {done ? (
        <TactileButton tone="success" size="lg" block onClick={finish}>
          סיום הסבב
        </TactileButton>
      ) : (
        <TactileButton tone="quiet" block icon="sparkle" onClick={reveal}>
          הראו לי מילה אחת
        </TactileButton>
      )}
    </>
  );
  // Landscape: the board beside the instructions and word list; portrait: one stack.
  return landscape ? (
    <div className={`${styles.game} panes`}>
      <div className="pane-prompt">
        {prompt}
        {list}
      </div>
      <div className="pane-play">{board}</div>
    </div>
  ) : (
    <div className={styles.game}>
      {prompt}
      {board}
      {list}
    </div>
  );
}
