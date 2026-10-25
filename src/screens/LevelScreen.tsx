import { Navigate, useNavigate, useParams } from 'react-router';
import { findLevel } from '../engine/layout';
import { isLevelUnlocked } from '../engine/progress';
import { itemLabel, layout } from '../app/data';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { IconButton, TopBar } from '../ui/TopBar';
import { levelNumber, levelTitle } from './levelText';
import styles from './LevelScreen.module.css';

/** Level entry point. The level engine (learn cards and rounds) arrives in milestone 3. */
export function LevelScreen() {
  const { levelId = '' } = useParams();
  const navigate = useNavigate();
  const { progress, loaded } = useProgress();
  const found = findLevel(layout, levelId);
  if (!loaded) return null;
  if (!found || !isLevelUnlocked(progress, found.world, levelId)) return <Navigate to="/" replace />;
  const { world, station, level } = found;
  const number = levelNumber(level, station);
  const words = level.itemIds.map((id) => itemLabel(id)).filter(Boolean);

  return (
    <div data-world={world.id} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה לשביל" onClick={() => navigate(`/world/${world.id}`)}>
            <Icon name="back" />
          </IconButton>
        }
        title={number ? `שלב ${number}: ${levelTitle(level, station)}` : levelTitle(level, station)}
        subtitle={station?.title}
      />
      <div className={styles.body}>
        <MascotBubble>המשחקים של השלב הזה בדרך. בינתיים, אלה המילים שנלמד:</MascotBubble>
        {words.length > 0 && (
          <ul className={styles.words}>
            {words.map((w) => (
              <li key={w} className={styles.word}>
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
