import { lazy, Suspense, useCallback, useState, type FormEvent } from 'react';
import { normalizePairingCode } from '../../sync/local';
import { useSync } from '../../sync/sync-context';
import { Icon } from '../../ui/Icon';
import { TactileButton } from '../../ui/TactileButton';
import styles from './parent.module.css';

const QrScanner = lazy(async () => ({ default: (await import('./QrScanner')).QrScanner }));

const MESSAGE = {
  denied: 'הקוד לא תקף: אולי הוקלד לא נכון, כבר שומש, או שעברו יותר מ־10 דקות. צרו קוד חדש במצב הורים.',
  offline: 'אין חיבור לאינטרנט. החיבור לטלפון של ההורה דורש רשת; המשחק עצמו ממשיך לעבוד גם בלי.',
  error: 'החיבור לא הצליח. נסו שוב בעוד רגע.',
} as const;

/**
 * Pairs this device with a parent's phone: the code shown in parent mode, typed or scanned as a QR code. Pairing copies
 * the parents' passcode hash to this device, so the parent area works offline afterwards.
 */
export function PairDevice({ initialCode = '', onPaired }: { initialCode?: string; onPaired: () => void }) {
  const { pair } = useSync();
  const [code, setCode] = useState(initialCode);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: string) => {
      const normalized = normalizePairingCode(input);
      if (!normalized) return setError('קוד חיבור הוא 8 אותיות וספרות, כמו K7QM-2XRA.');
      setBusy(true);
      setError(null);
      const result = await pair(normalized);
      setBusy(false);
      if (result === 'ok') onPaired();
      else setError(MESSAGE[result]);
    },
    [pair, onPaired],
  );
  const onScanned = useCallback(
    (text: string) => {
      setScanning(false);
      setCode(text);
      void submit(text);
    },
    [submit],
  );

  return (
    <form
      className={styles.card}
      aria-label="חיבור לטלפון של ההורה"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void submit(code);
      }}
    >
      <h3 className={styles.toggleTitle}>חיבור לטלפון של ההורה</h3>
      <p className={styles.muted}>
        במצב הורים בטלפון שלכם בחרו ״חיבור מכשיר״, ואז סרקו כאן את קוד ה־QR או הקלידו את קוד החיבור. הקוד תקף ל־10 דקות.
      </p>
      <label className={styles.field}>
        <span>קוד חיבור</span>
        <input
          className={styles.input}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX"
        />
      </label>
      {error && (
        <p className={styles.danger} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <TactileButton type="submit" icon="key" disabled={busy || code.trim() === ''}>
          {busy ? 'מתחבר...' : 'חיבור'}
        </TactileButton>
        {typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && (
          <button type="button" className={styles.linkButton} onClick={() => setScanning(!scanning)}>
            <Icon name={scanning ? 'close' : 'eye'} size="sm" /> {scanning ? 'סגירת המצלמה' : 'סריקת קוד QR'}
          </button>
        )}
      </div>
      {scanning && (
        <Suspense fallback={<p className={styles.muted}>פותח מצלמה...</p>}>
          <QrScanner onText={onScanned} />
        </Suspense>
      )}
    </form>
  );
}
