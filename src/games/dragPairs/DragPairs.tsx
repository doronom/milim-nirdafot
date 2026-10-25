import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { motion as m } from 'framer-motion';
import { useState } from 'react';
import { motion } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { useGameEnv } from '../env-context';
import type { Answer, GameProps, PracticeItem } from '../types';
import { Dots } from '../ui/Dots';
import introStyles from '../ui/RoundIntro.module.css';
import { dropMatches, type DragRound } from './build';
import styles from './DragPairs.module.css';

function Chip({
  item,
  selected,
  onTap,
  label,
}: {
  item: PracticeItem;
  selected: boolean;
  onTap: () => void;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.key });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${styles.chip} ${isDragging ? styles.dragging : ''} ${selected ? styles.selected : ''}`}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      aria-pressed={selected}
    >
      <Icon name="sparkle" size="sm" />
      <span>{label}</span>
    </button>
  );
}

function Target({
  item,
  matchedWith,
  flash,
  onTap,
  label,
}: {
  item: PracticeItem;
  matchedWith: string | null;
  flash: boolean;
  onTap: () => void;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: item.key, disabled: matchedWith !== null });
  const state = matchedWith ? styles.matched : flash ? styles.mismatch : isOver ? styles.over : '';
  return (
    <m.button
      ref={setNodeRef}
      type="button"
      className={`${styles.target} ${state}`}
      onClick={onTap}
      disabled={matchedWith !== null}
      animate={flash ? { x: [0, -6, 6, -4, 4, 0] } : {}}
      transition={motion('feedback_shake')}
    >
      <span className={styles.targetWord}>{label}</span>
      {matchedWith ? (
        <span className={styles.matchedWith}>
          <Icon name="check" size="sm" />
          {matchedWith}
        </span>
      ) : flash ? (
        <span className={styles.hint}>לא מתאים</span>
      ) : isOver ? (
        <span className={styles.hint}>שחרר כאן</span>
      ) : null}
    </m.button>
  );
}

/** Drag each word onto its synonym (or tap a word, then its synonym). Wrong drops spring back. */
export function DragPairs({ round, onDone }: GameProps<DragRound>) {
  const env = useGameEnv();
  const [boardIndex, setBoardIndex] = useState(0);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [missedKeys, setMissedKeys] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const board = round.boards[boardIndex]!;
  const lastBoard = boardIndex === round.boards.length - 1;
  const boardDone = board.targets.every((t) => matched[t.key]);

  const attempt = (chipKey: string, targetKey: string) => {
    const chip = board.chips.find((c) => c.key === chipKey);
    const target = board.targets.find((t) => t.key === targetKey);
    if (!chip || !target || matched[target.key] || Object.values(matched).includes(chip.key)) return;
    setSelected(null);
    if (dropMatches(env, chip, target)) {
      setMatched((m) => ({ ...m, [target.key]: chip.key }));
      // One answer per item: correct unless it was dropped wrong before.
      setAnswers((a) => [...a, { itemKey: chip.key, outcome: missedKeys.includes(chip.key) ? 'wrong' : 'correct' }]);
    } else {
      setMissedKeys((k) => (k.includes(chip.key) ? k : [...k, chip.key]));
      setFlash(target.key);
      window.setTimeout(() => setFlash(null), motion('feedback_shake').duration * 1000 + 300);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) attempt(String(e.active.id), String(e.over.id));
  };

  const next = () => {
    if (lastBoard) {
      onDone({ answers });
      return;
    }
    setBoardIndex(boardIndex + 1);
    setMatched({});
  };

  const placed = new Set(Object.values(matched));
  const chipWord = (key: string) => env.displayWord(board.chips.find((c) => c.key === key)!.entry.headword);

  return (
    <div className={styles.game}>
      {round.boards.length > 1 && (
        <Dots
          states={round.boards.map((_, i) => (i < boardIndex ? 'done' : i === boardIndex ? 'current' : 'todo'))}
          label={`לוח ${boardIndex + 1} מתוך ${round.boards.length}`}
        />
      )}
      <p className={introStyles.prompt}>גררו כל מילה אל המילה הנרדפת שלה</p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={styles.columns}>
          <div className={styles.column} role="group" aria-label="מילים לגרירה">
            {board.chips
              .filter((c) => !placed.has(c.key))
              .map((c) => (
                <Chip
                  key={c.key}
                  item={c}
                  label={env.displayWord(c.entry.headword)}
                  selected={selected === c.key}
                  onTap={() => setSelected(selected === c.key ? null : c.key)}
                />
              ))}
          </div>
          <div className={styles.column} role="group" aria-label="מילים נרדפות">
            {board.targets.map((t) => (
              <Target
                key={t.key}
                item={t}
                label={env.displayWord(t.synonym)}
                matchedWith={matched[t.key] ? chipWord(matched[t.key]!) : null}
                flash={flash === t.key}
                onTap={() => selected && attempt(selected, t.key)}
              />
            ))}
          </div>
        </div>
      </DndContext>
      {boardDone && (
        <TactileButton tone="success" size="lg" block onClick={next}>
          {lastBoard ? 'סיום הסבב' : 'ללוח הבא'}
        </TactileButton>
      )}
    </div>
  );
}
