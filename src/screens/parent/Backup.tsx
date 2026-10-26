import { useState } from 'react';
import { totalStars, type Progress } from '../../engine/progress';
import { dayKey } from '../../engine/dates';
import { download, shareOrDownload } from '../../share/share-image';
import { createBackup, parseBackup, PROGRESS_KEY, restoreBackup, type BackupFile } from '../../state/backup';
import { useContent } from '../../state/content-context';
import { useProgress } from '../../state/progress-context';
import { useStore } from '../../state/store-context';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

const when = new Intl.DateTimeFormat('he', { dateStyle: 'medium', timeStyle: 'short' });

function Summary({ p, customWords }: { p: Progress; customWords: number }) {
  return (
    <div className={styles.grid2}>
      {[
        ['עולמות פתוחים', p.settings.unlockAll ? 4 : p.unlockedWorlds.length],
        ['שלבים שהושלמו', Object.keys(p.levels).length],
        ['כוכבים', totalStars(p)],
        ['פריטים בתרגול', Object.keys(p.leitner).length],
        ['רצף ימים', p.streak.days],
        ['מילים שלי', customWords],
      ].map(([label, value]) => (
        <div key={label} className={styles.item}>
          <span className={styles.caption}>{label}</span>
          <span className={styles.word}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** Export and import everything on the device as one plain JSON file. */
export function Backup() {
  const store = useStore();
  const { progress } = useProgress();
  const { overrides } = useContent();
  const [status, setStatus] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<BackupFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const filename = `word-quest-backup-${dayKey()}.json`;

  const file = async () => new Blob([JSON.stringify(await createBackup(store), null, 2)], { type: 'application/json' });

  const pick = async (f: File | undefined) => {
    setError(null);
    setIncoming(null);
    if (!f) return;
    try {
      setIncoming(parseBackup(JSON.parse(await f.text())));
    } catch (e) {
      setError(e instanceof SyntaxError ? 'הקובץ אינו JSON תקין' : (e as Error).message);
    }
  };

  const restore = async () => {
    if (!incoming) return;
    setRestoring(true);
    await restoreBackup(store, incoming);
    // Every screen reads the store fresh after a reload, so nothing keeps the old progress in memory.
    window.location.reload();
  };

  return (
    <ParentPage title="גיבוי ושחזור">
      <section className={styles.card} aria-labelledby="backup-export">
        <h2 id="backup-export" className={styles.cardTitle}>
          <Icon name="download" /> ייצוא לקובץ
        </h2>
        <p className={styles.muted}>
          קובץ JSON רגיל אחד עם כל ההתקדמות, המילים וההקלטות שלכם, שינויי התוכן ודיווחי המשחק. הקובץ אינו מוצפן; שמרו
          אותו במקום פרטי.
        </p>
        <Summary p={progress} customWords={overrides.custom.length} />
        <div className={styles.actions}>
          <TactileButton
            icon="download"
            onClick={async () => {
              download(await file(), filename);
              setStatus('קובץ הגיבוי נשמר.');
            }}
          >
            הורדת קובץ גיבוי
          </TactileButton>
          <TactileButton
            tone="quiet"
            icon="upload"
            onClick={async () => {
              const r = await shareOrDownload(await file(), filename, 'גיבוי מסע המילים');
              setStatus(r === 'shared' ? 'הגיבוי שותף.' : r === 'downloaded' ? 'קובץ הגיבוי נשמר.' : null);
            }}
          >
            שיתוף
          </TactileButton>
        </div>
        {status && (
          <p className={styles.ok} role="status">
            {status}
          </p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="backup-import">
        <h2 id="backup-import" className={styles.cardTitle}>
          <Icon name="upload" /> שחזור מקובץ גיבוי
        </h2>
        <label className={styles.notice}>
          <span>בחרו קובץ גיבוי (word-quest-backup-*.json)</span>
          <input
            type="file"
            accept="application/json,.json"
            aria-label="קובץ גיבוי"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        {error && (
          <p className={styles.danger} role="alert">
            {error}
          </p>
        )}
        {incoming && (
          <>
            <p className={styles.muted}>גיבוי מתאריך {when.format(new Date(incoming.exportedAt))}:</p>
            <Summary
              p={incoming.data[PROGRESS_KEY] as Progress}
              customWords={
                ((incoming.data['content:overrides'] as { custom?: unknown[] } | undefined)?.custom ?? []).length
              }
            />
            <div className={styles.error} role="alert">
              <strong>שימו לב: השחזור מחליף את כל הנתונים במכשיר הזה.</strong>
              <span>מומלץ לייצא גיבוי של המצב הנוכחי לפני כן.</span>
              <div className={styles.actions}>
                <TactileButton tone="danger" icon="refresh" onClick={() => void restore()} disabled={restoring}>
                  שחזור והפעלה מחדש
                </TactileButton>
                <TactileButton tone="quiet" onClick={() => setIncoming(null)}>
                  ביטול
                </TactileButton>
              </div>
            </div>
          </>
        )}
      </section>
    </ParentPage>
  );
}
