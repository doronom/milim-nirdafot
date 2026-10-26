import { useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_SECONDS, playBlob } from '../../audio/recordings';
import { Icon } from '../../ui/Icon';
import styles from './parent.module.css';
import r from './Recorder.module.css';

type State =
  | { kind: 'idle' }
  | { kind: 'recording'; seconds: number }
  | { kind: 'denied' }
  | { kind: 'unsupported' }
  | { kind: 'error' };

const supported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/**
 * Records up to 5 seconds of the parent saying the word. Handles a refused microphone permission with an explanation;
 * the word can always be saved without a recording (speech reads it instead).
 */
export function Recorder({ value, onChange }: { value: Blob | null; onChange: (b: Blob | null) => void }) {
  const [state, setState] = useState<State>(() => (supported() ? { kind: 'idle' } : { kind: 'unsupported' }));
  const live = useRef<{ recorder: MediaRecorder; stream: MediaStream; timer: number } | null>(null);

  const finish = () => {
    const l = live.current;
    if (!l) return;
    window.clearInterval(l.timer);
    if (l.recorder.state !== 'inactive') l.recorder.stop();
  };
  useEffect(
    () => () => {
      const l = live.current;
      if (!l) return;
      window.clearInterval(l.timer);
      if (l.recorder.state !== 'inactive') l.recorder.stop();
      l.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string }).name;
      setState({ kind: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error' });
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (ev) => ev.data.size > 0 && chunks.push(ev.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      live.current = null;
      onChange(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null);
      setState({ kind: 'idle' });
    };
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      if (seconds >= MAX_RECORDING_SECONDS) finish();
      else setState({ kind: 'recording', seconds });
    }, 100);
    live.current = { recorder, stream, timer };
    recorder.start();
    setState({ kind: 'recording', seconds: 0 });
  };

  if (state.kind === 'unsupported') {
    return <p className={styles.notice}>הדפדפן הזה לא תומך בהקלטה. המילה תוקרא בהקראה אוטומטית.</p>;
  }
  if (state.kind === 'denied') {
    return (
      <div className={styles.error} role="alert">
        <strong>
          <Icon name="mic" size="sm" /> הרשאת המיקרופון חסומה
        </strong>
        <span>
          כדי להקליט, אפשרו גישה למיקרופון בהגדרות הדפדפן (בלחיצה על סמל המנעול ליד כתובת האתר), ואז נסו שוב. אפשר גם
          לשמור את המילה בלי הקלטה.
        </span>
        <button type="button" className={styles.linkButton} onClick={() => setState({ kind: 'idle' })}>
          <Icon name="refresh" size="sm" /> לנסות שוב
        </button>
      </div>
    );
  }
  if (state.kind === 'recording') {
    return (
      <div className={r.box}>
        <span className={r.time} aria-live="polite">
          00:0{Math.floor(state.seconds)} / 00:0{MAX_RECORDING_SECONDS}
        </span>
        <span className={styles.muted}>מקליט... דברו ברור ליד המכשיר</span>
        <button type="button" className={r.stop} onClick={finish}>
          <Icon name="stop" /> סיום
        </button>
      </div>
    );
  }
  return (
    <div className={r.box}>
      {state.kind === 'error' && (
        <p className={styles.danger} role="alert">
          ההקלטה לא הצליחה. נסו שוב.
        </p>
      )}
      {value ? (
        <div className={styles.actions}>
          <button type="button" className={styles.linkButton} onClick={() => playBlob(value)}>
            <Icon name="play" size="sm" /> השמעה
          </button>
          <button type="button" className={styles.linkButton} onClick={() => void start()}>
            <Icon name="refresh" size="sm" /> הקלטה מחדש
          </button>
          <button type="button" className={styles.linkButton} onClick={() => onChange(null)}>
            <Icon name="trash" size="sm" /> מחיקת ההקלטה
          </button>
        </div>
      ) : (
        <>
          <button type="button" className={r.mic} onClick={() => void start()} aria-label="התחלת הקלטה">
            <Icon name="mic" size="xl" />
          </button>
          <span className={styles.muted}>לחצו והקליטו את המילה (עד {MAX_RECORDING_SECONDS} שניות)</span>
        </>
      )}
    </div>
  );
}
