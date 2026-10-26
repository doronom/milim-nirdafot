import {
  DndContext,
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
import { WORLDS, type WorldId } from '../config/game';
import { motion } from '../design/tokens';
import { placeSticker, stickerState, worldStickers, type Sticker as StickerDef } from '../engine/album';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { Sticker } from '../ui/Sticker';
import { TactileButton } from '../ui/TactileButton';
import { TopBar } from '../ui/TopBar';
import styles from './AlbumScreen.module.css';

function Slot({ sticker, state }: { sticker: StickerDef; state: 'locked' | 'waiting' | 'placed' }) {
  const { setNodeRef, isOver } = useDroppable({ id: sticker.levelId, disabled: state !== 'waiting' });
  return (
    <li
      ref={setNodeRef}
      className={`${styles.slot} ${state === 'waiting' ? styles.open : ''} ${isOver ? styles.over : ''}`}
    >
      {state === 'placed' ? (
        <m.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={motion('sticker_placement')}>
          <Sticker sticker={sticker} />
        </m.span>
      ) : (
        <Sticker sticker={sticker} silhouette />
      )}
      {state === 'waiting' && <span className={styles.hint}>שחררו את המדבקה כאן</span>}
    </li>
  );
}

function TrayItem({ sticker, onPlace }: { sticker: StickerDef; onPlace: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: sticker.levelId });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div className={styles.trayItem}>
      <span
        ref={setNodeRef}
        style={style}
        className={styles.draggable}
        {...listeners}
        {...attributes}
        aria-label={`גררו את ${sticker.name} לאלבום`}
      >
        <Sticker sticker={sticker} />
      </span>
      <TactileButton tone="success" icon="sparkle" onClick={onPlace}>
        הדבק כאן
      </TactileButton>
    </div>
  );
}

/** The sticker album: one page per world, one slot per level; earned stickers wait in a tray to be dragged into place. */
export function AlbumScreen() {
  const { layout, stickerLabel } = useGameData();
  const { progress, update } = useProgress();
  const [world, setWorld] = useState<WorldId>(1);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
  );
  const all = WORLDS.flatMap((w) => worldStickers(layout, w.id, stickerLabel));
  const placed = all.filter((s) => stickerState(progress, s.levelId) === 'placed').length;
  const page = worldStickers(layout, world, stickerLabel);
  const waiting = page.filter((s) => stickerState(progress, s.levelId) === 'waiting');
  const place = (levelId: string) => update((p) => placeSticker(p, levelId));
  const onDragEnd = (e: DragEndEvent) => {
    // A sticker fits only its own slot.
    if (e.over && e.over.id === e.active.id) place(String(e.active.id));
  };

  return (
    <div data-world={world} className={styles.screen}>
      <TopBar title="אלבום מדבקות המסע" subtitle={`${placed} מתוך ${all.length} מדבקות נאספו`} />
      <div className={styles.body}>
        <div className={styles.overall}>
          <span>התקדמות האוסף</span>
          <span className={styles.pct}>{Math.round((placed / all.length) * 100)}%</span>
          <ProgressBar value={placed} max={all.length} label="התקדמות האלבום" />
        </div>
        <div className={styles.tabs} role="tablist" aria-label="עולמות">
          {WORLDS.map((w) => {
            const stickers = worldStickers(layout, w.id, stickerLabel);
            const done = stickers.filter((s) => stickerState(progress, s.levelId) === 'placed').length;
            return (
              <button
                key={w.id}
                type="button"
                role="tab"
                aria-selected={world === w.id}
                data-world={w.id}
                className={`${styles.tab} ${world === w.id ? styles.tabOn : ''}`}
                onClick={() => setWorld(w.id)}
              >
                <Icon name={w.icon} />
                <span>{w.name}</span>
                <span className={styles.tabCount}>
                  {done}/{stickers.length}
                </span>
              </button>
            );
          })}
        </div>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {waiting.length > 0 && (
            <section className={styles.tray} aria-label="מדבקות שממתינות להדבקה">
              <p className={styles.trayTitle}>
                <Pill tone="success">חדש</Pill>
                {waiting.length === 1 ? 'מדבקה חדשה ממתינה להדבקה!' : `${waiting.length} מדבקות ממתינות להדבקה!`}
              </p>
              {waiting.slice(0, 3).map((s) => (
                <TrayItem key={s.levelId} sticker={s} onPlace={() => place(s.levelId)} />
              ))}
            </section>
          )}
          <ul className={styles.grid} aria-label={`עמוד האלבום: ${WORLDS.find((w) => w.id === world)!.name}`}>
            {page.map((s) => (
              <Slot key={s.levelId} sticker={s} state={stickerState(progress, s.levelId)} />
            ))}
          </ul>
        </DndContext>
      </div>
    </div>
  );
}
