import { toBlob } from 'html-to-image';
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { rankForXp, WORLDS, type WorldId } from '../config/game';
import { certificateDates } from '../engine/certificate';
import { isLevelDone } from '../engine/progress';
import { shareOrDownload, type ShareResult } from '../share/share-image';
import { useGameData } from '../state/content-context';
import { useProgress } from '../state/progress-context';
import { Icon } from '../ui/Icon';
import { MascotBubble } from '../ui/MascotBubble';
import { TactileButton } from '../ui/TactileButton';
import { IconButton, TopBar } from '../ui/TopBar';
import styles from './CertificateScreen.module.css';

/** The certificate for a completed world: rendered to PNG and shared, or saved when sharing is not available. */
export function CertificateScreen() {
  const { layout } = useGameData();
  const { worldId } = useParams();
  const navigate = useNavigate();
  const { progress, loaded } = useProgress();
  const card = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShareResult | 'failed' | null>(null);
  const world = layout.worlds.find((w) => String(w.id) === worldId);
  if (!loaded) return null;
  if (!world || !isLevelDone(progress, world.boss.id)) return <Navigate to="/profile" replace />;

  const config = WORLDS.find((w) => w.id === world.id)!;
  const name = progress.settings.childName?.trim() || 'חוקר המילים';
  // Computed on every render, so the certificate always shows today's dates.
  const dates = certificateDates(new Date());
  const words = world.stations.reduce((n, s) => n + s.levels.reduce((m, l) => m + l.itemIds.length, 0), 0);

  const share = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      const background = getComputedStyle(document.body).backgroundColor;
      const blob = await toBlob(card.current, { pixelRatio: 2, backgroundColor: background });
      if (!blob) throw new Error('render failed');
      setResult(await shareOrDownload(blob, `תעודה-${config.name}.png`, `תעודת ${config.name}`));
    } catch {
      setResult('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-world={world.id as WorldId} className={styles.screen}>
      <TopBar
        start={
          <IconButton label="חזרה" onClick={() => navigate('/profile')}>
            <Icon name="back" />
          </IconButton>
        }
        title="תעודת הרפתקן רשמית"
      />
      <main className={styles.body}>
        <div ref={card} className={styles.card}>
          <span className={styles.seal}>
            <Icon name="compass" size="xl" />
          </span>
          <span className={styles.world}>
            {config.name} · עולם {world.id}
          </span>
          <h2 className={styles.title}>תעודת גילוי והצטיינות</h2>
          <p className={styles.sub}>מוענקת בגאווה ובכבוד רב ל</p>
          <div className={styles.nameBox}>
            <p className={styles.name}>{name}</p>
            <p className={styles.rank}>דרגת כבוד: {rankForXp(progress.xp)}</p>
          </div>
          <p className={styles.achievement}>
            <Icon name="check" />
            השלים/ה בהצלחה את כל תחנות {config.name}, פענח/ה {words} אתגרי מילים והביס/ה את שומר העולם!
          </p>
          <div className={styles.footer}>
            <span className={styles.stamp}>
              <Icon name="shield" size="lg" />
              <span>
                <strong>אושר רשמית</strong>
                <br />
                מצפוני המלווה
              </span>
            </span>
            <span className={styles.dates}>
              <strong>{dates.hebrew}</strong>
              <br />
              {dates.gregorian}
            </span>
          </div>
        </div>
        <MascotBubble title="טיפ ממצפוני">ההורים והסבים ישמחו מאוד לראות את התעודה הזו!</MascotBubble>
        {typeof navigator !== 'undefined' && navigator.onLine === false && (
          <p className={styles.notice} role="status">
            אין חיבור לרשת כרגע. שליחה לאחרים תעבוד כשהרשת תחזור; שמירה כתמונה עובדת גם עכשיו.
          </p>
        )}
        <TactileButton tone="success" block size="lg" icon="sparkle" onClick={share} disabled={busy}>
          שתפו עם המשפחה
        </TactileButton>
        {result === 'downloaded' && (
          <p className={styles.notice} role="status">
            התעודה נשמרה כתמונה במכשיר.
          </p>
        )}
        {result === 'failed' && (
          <p className={styles.notice} role="status">
            לא הצלחנו ליצור את התמונה. נסו שוב.
          </p>
        )}
      </main>
    </div>
  );
}
