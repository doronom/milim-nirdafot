import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { BOSS_SIZE, WORLDS, type WorldId } from '../config/game';
import type { LevelDef, StationDef, WorldDef } from '../engine/layout';
import { currentLevel, isLevelDone, isLevelUnlocked, isWorldUnlocked, type Progress } from '../engine/progress';
import { dayKey } from '../engine/dates';
import { selectGuests } from '../engine/guests';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { Pill } from '../ui/Pill';
import { Stars } from '../ui/Stars';
import { StatusPills } from '../ui/StatusPills';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import { levelNumber, levelTitle } from './levelText';
import styles from './WorldScreen.module.css';

type NodeState = 'done' | 'current' | 'open' | 'locked';

const preview = (level: LevelDef, itemLabel: (id: string) => string | undefined) =>
  level.itemIds
    .slice(0, 3)
    .map((id) => itemLabel(id))
    .filter(Boolean)
    .join(', ');

function nodeState(p: Progress, world: WorldDef, level: LevelDef, current: LevelDef | null): NodeState {
  if (current?.id === level.id) return 'current';
  if (isLevelDone(p, level.id)) return 'done';
  return isLevelUnlocked(p, world, level.id) ? 'open' : 'locked';
}

export function WorldScreen() {
  const { worldId } = useParams();
  const navigate = useNavigate();
  const { progress, loaded } = useProgress();
  const { layout, itemLabel, guestResolver } = useGameData();
  const currentRef = useRef<HTMLLIElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const world = layout.worlds.find((w) => String(w.id) === worldId);
  const current = world ? currentLevel(progress, world) : null;

  // Center the current level in the space between the top bar and the dock, not the whole viewport.
  // Runs again once saved progress has loaded, since that moves the current level.
  useEffect(() => {
    const node = currentRef.current;
    if (!node?.getBoundingClientRect || typeof window.scrollBy !== 'function') return;
    const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const bottom = dockRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    const rect = node.getBoundingClientRect();
    window.scrollBy({ top: rect.top + rect.height / 2 - (top + bottom) / 2, behavior: 'instant' });
  }, [worldId, loaded, current?.id]);

  // Until saved progress loads, an unlocked world would look locked and redirect.
  if (!loaded) return null;
  if (!world || !isWorldUnlocked(progress, world.id as WorldId)) return <Navigate to="/" replace />;

  const config = WORLDS.find((w) => w.id === world.id)!;
  const currentStation = world.stations.find((s) => s.levels.some((l) => l.id === current?.id));
  const stationDone = (s: StationDef) => s.levels.every((l) => isLevelDone(progress, l.id));
  // Due words from earlier levels that will join the current level as guests.
  const guests =
    current?.kind === 'learn'
      ? selectGuests(
          progress.leitner,
          current.itemIds,
          current.itemIds.length,
          dayKey(),
          guestResolver(progress.settings.reviewedOnly),
        ).length
      : 0;

  const renderLevel = (level: LevelDef, station?: StationDef) => {
    const state = nodeState(progress, world, level, current);
    const number = levelNumber(level, station);
    const title = levelTitle(level, station);
    const words = preview(level, itemLabel);
    const stars = progress.levels[level.id]?.stars ?? 0;
    const name = number ? `שלב ${number}: ${title}` : title;
    const to = `/level/${level.id}`;

    if (state === 'current') {
      return (
        <li key={level.id} ref={currentRef} className={`${styles.node} ${styles.currentWrap}`}>
          <div className={styles.currentCard}>
            <Link className={styles.playTile} to={to} aria-label={`התחל ${name}`}>
              <Icon name="play" size="xl" />
            </Link>
            <p className={styles.currentTitle}>{name}</p>
            {words && <p className={styles.currentWords}>{words}</p>}
            {guests > 0 && (
              <Pill tone="guest" icon="refresh">
                {guests === 1 ? 'מילה אורחת בדרך!' : `${guests} מילים אורחות בדרך!`}
              </Pill>
            )}
            <Stars count={stars} />
            <TactileButton icon="bolt" to={to}>
              התחל שלב
            </TactileButton>
          </div>
        </li>
      );
    }

    const tile = (
      <span className={`${styles.tile} ${styles[state]}`}>
        <Icon name={state === 'done' ? 'check' : state === 'locked' ? 'lock' : 'play'} size="xl" />
        {number && <span className={styles.badge}>{number}</span>}
      </span>
    );
    return (
      <li key={level.id} className={styles.node}>
        {state === 'locked' ? (
          <span className={styles.nodeLink} aria-label={`${name}, נעול`}>
            {tile}
          </span>
        ) : (
          <Link className={styles.nodeLink} to={to} aria-label={state === 'done' ? `${name}, הושלם` : name}>
            {tile}
          </Link>
        )}
        <p className={styles.nodeTitle}>{name}</p>
        {words && <p className={styles.nodeWords}>{words}</p>}
        {state === 'done' && <Stars count={stars} />}
      </li>
    );
  };

  const bossState = nodeState(progress, world, world.boss, current);

  return (
    <div data-world={world.id} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה למפה" onClick={() => navigate('/')}>
            <Icon name="back" />
          </IconButton>
        }
        title={
          <>
            <Icon name={config.icon} />
            {config.name}
          </>
        }
        subtitle={
          currentStation
            ? `עולם ${world.id} · תחנה ${currentStation.index}: ${currentStation.title}`
            : `עולם ${world.id}`
        }
        end={<StatusPills />}
      />
      <div className={styles.segments} aria-hidden>
        {world.stations.map((s) => (
          <span
            key={s.id}
            className={`${styles.segment} ${stationDone(s) ? styles.segDone : s.id === currentStation?.id ? styles.segCurrent : ''}`}
          />
        ))}
      </div>

      <ol className={styles.path} aria-label={`שביל התחנות ב${config.name}`}>
        <li className={styles.start}>
          <Pill icon="compass">נקודת היציאה</Pill>
        </li>
        {[...world.stations, ...(world.id === 1 && layout.custom ? [layout.custom] : [])].map((station) => (
          <li key={station.id} className={styles.stationGroup}>
            <ol className={styles.stationLevels}>
              <li className={styles.stationMarker}>
                <span className={styles.stationIcon}>
                  <Icon
                    name={
                      stationDone(station)
                        ? 'check'
                        : isLevelUnlocked(progress, world, station.levels[0]!.id)
                          ? 'map'
                          : 'lock'
                    }
                  />
                </span>
                <span>
                  <span className={styles.stationName}>
                    תחנה {station.index}: {station.title}
                  </span>
                  <span className={styles.stationMeta}>
                    {station.kind === 'custom' ? 'המילים שהוסיפו ההורים · פתוח תמיד' : `${station.levels.length} שלבים`}
                  </span>
                </span>
              </li>
              {station.levels.map((level) => renderLevel(level, station))}
            </ol>
          </li>
        ))}
        <li className={`${styles.node} ${styles.boss}`}>
          <span className={`${styles.tile} ${styles[bossState === 'current' ? 'open' : bossState]}`}>
            <Icon name={bossState === 'locked' ? 'lock' : 'crown'} size="xl" />
          </span>
          <Pill tone="xp" icon="swords">
            קרב הבוס
          </Pill>
          <p className={styles.nodeWords}>{BOSS_SIZE} שאלות מכל העולם</p>
          {bossState !== 'locked' && (
            <TactileButton icon="swords" to={`/level/${world.boss.id}`}>
              לקרב
            </TactileButton>
          )}
        </li>
      </ol>

      {current && (
        <div ref={dockRef} className={styles.dock}>
          <MascotBubble>
            {current.kind === 'boss'
              ? 'כל השלבים הושלמו! הגיע הזמן לקרב הבוס.'
              : currentStation
                ? `שלב ${levelNumber(current, currentStation)} מוכן! מילים חדשות מחכות לנו ב${currentStation.title}.`
                : 'השלב הבא מוכן!'}
          </MascotBubble>
          <TactileButton icon="play" size="lg" block to={`/level/${current.id}`}>
            שחק עכשיו{currentStation ? ` · שלב ${levelNumber(current, currentStation)}` : ''}
          </TactileButton>
        </div>
      )}
    </div>
  );
}
