import { motion as m, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { rankForXp, WORLDS } from '../config/game';
import { motion } from '../design/tokens';
import { dailyGoal, reachedGoal } from '../engine/activity';
import { dayKey } from '../engine/dates';
import { activeWorld, currentLevel, isWorldUnlocked, totalStars, worldStats } from '../engine/progress';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusPills } from '../ui/StatusPills';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import styles from './WorldMapScreen.module.css';

export function WorldMapScreen() {
  const { layout } = useGameData();
  const { progress } = useProgress();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const active = activeWorld(progress, layout);
  const activeConfig = WORLDS.find((w) => w.id === active.id)!;
  const enter = motion('screen_enter');

  return (
    <div data-world={active.id} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="אזור הורים" onClick={() => navigate('/parent')}>
            <Icon name="lock" />
          </IconButton>
        }
        title={
          <>
            <Icon name="compass" />
            {activeConfig.name}
          </>
        }
        end={<StatusPills />}
      />

      <section className={styles.rankRow} aria-label="הדרגה שלי">
        <span className={styles.rankIcon}>
          <Icon name="compass" size="lg" />
        </span>
        <div>
          <p className={styles.rankLabel}>דרגת משלחת</p>
          <p className={styles.rankName}>{rankForXp(progress.xp)}</p>
        </div>
        <span className={styles.rankStars}>
          <Pill tone="xp" icon="star" label={`${totalStars(progress)} כוכבים`}>
            {totalStars(progress)}
          </Pill>
        </span>
      </section>

      {reachedGoal(progress, dayKey()) && (
        <div className={styles.goal}>
          <MascotBubble>
            כל הכבוד! הגעתם ליעד היומי של {dailyGoal(progress)} דקות. אפשר להמשיך לשחק, או לנוח ולחזור מחר.
          </MascotBubble>
        </div>
      )}

      <header className={styles.intro}>
        <Pill tone="world">מפת מסע ארבעת העולמות</Pill>
        <h2 className={styles.heading}>מסע המילים</h2>
        <p className={styles.lead}>חצו את האיים, פתחו שערים לשוניים וחשפו את אוצרות השפה</p>
      </header>

      <ol className={styles.worlds}>
        {layout.worlds.map((world, i) => {
          const config = WORLDS.find((w) => w.id === world.id)!;
          const unlocked = isWorldUnlocked(progress, world.id);
          const isActive = world.id === active.id;
          const isNext = !unlocked && isWorldUnlocked(progress, (world.id - 1) as typeof world.id);
          const stats = worldStats(progress, world);
          const next = currentLevel(progress, world);
          const state = isActive ? 'active' : unlocked ? 'open' : isNext ? 'next' : 'locked';
          const status = isActive ? 'פעיל עכשיו' : unlocked ? 'פתוח' : isNext ? 'השלב הבא' : 'נעול';
          return (
            <m.li
              key={world.id}
              data-world={world.id}
              className={styles.item}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...enter, delay: reduced ? 0 : i * 0.06 }}
            >
              {i > 0 && (
                <span className={`${styles.connector} ${unlocked || isNext ? styles.connectorLit : ''}`} aria-hidden />
              )}
              <article className={`${styles.card} ${styles[state]}`} aria-label={`${config.name}, ${status}`}>
                <div className={styles.cardHead}>
                  <Pill tone={unlocked || isNext ? 'world' : 'muted'} icon={unlocked ? undefined : 'lock'}>
                    עולם {world.id} · {status}
                  </Pill>
                  <span className={styles.cardMeta}>
                    {unlocked ? (
                      <Pill tone="xp" icon="star">
                        {stats.stars} כוכבים
                      </Pill>
                    ) : isNext ? (
                      `${stats.stationsDone}/${stats.stationsTotal} תחנות`
                    ) : (
                      <Icon name="eye-off" />
                    )}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div>
                    <h3 className={styles.worldName}>{config.name}</h3>
                    <p className={styles.tagline}>{config.tagline}</p>
                  </div>
                  <span className={styles.worldIcon}>
                    <Icon name={config.icon} size="xl" />
                  </span>
                </div>
                {unlocked && (
                  <>
                    <div className={styles.progressBox}>
                      <div className={styles.progressLabels}>
                        <span>התקדמות במסע</span>
                        <span className={styles.numeric}>
                          {stats.stationsDone} / {stats.stationsTotal} תחנות
                        </span>
                      </div>
                      <ProgressBar value={stats.levelsDone} max={stats.levelsTotal} label={`התקדמות ב${config.name}`} />
                    </div>
                    <TactileButton icon="compass" size="lg" block to={`/world/${world.id}`}>
                      {next ? (stats.levelsDone === 0 ? 'התחל במסע' : 'המשך במסע') : 'לסקור את העולם'}
                    </TactileButton>
                  </>
                )}
                {isNext && (
                  <p className={styles.unlockHint}>
                    <Icon name="key" size="sm" />
                    נפתח עם סיום {WORLDS.find((w) => w.id === world.id - 1)!.name}
                    {world.id === 2 ? ' (או במבחן מיון)' : ''}
                  </p>
                )}
              </article>
            </m.li>
          );
        })}
      </ol>
    </div>
  );
}
