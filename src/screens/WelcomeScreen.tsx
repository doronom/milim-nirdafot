import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import mascot from '../design/assets/mascot.svg';
import { needsOnboarding } from '../engine/progress';
import { useProgress } from '../state/progress-context';
import { TactileButton } from '../ui/TactileButton';
import styles from './WelcomeScreen.module.css';

/** First launch: a greeting, an optional name, and a choice between starting at the harbor or a placement challenge. */
export function WelcomeScreen() {
  const navigate = useNavigate();
  const { progress, loaded, update } = useProgress();
  const [name, setName] = useState(progress.settings.childName ?? '');
  if (!loaded) return null;
  if (!needsOnboarding(progress)) return <Navigate to="/" replace />;

  const saveName = () => update((p) => ({ ...p, settings: { ...p.settings, childName: name.trim() || undefined } }));
  return (
    <div data-world={1} className={styles.screen}>
      <img src={mascot} alt="" className={styles.mascot} />
      <h1 className={styles.title}>ברוכים הבאים למסע המילים!</h1>
      <p className={styles.lead}>אני מצפוני, המצפן שילווה אתכם בין ארבעה עולמות של מילים נרדפות.</p>
      <label className={styles.field}>
        <span>איך קוראים לך? (לא חובה)</span>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoComplete="off"
        />
      </label>
      <TactileButton
        block
        size="lg"
        icon="compass"
        onClick={() => {
          saveName();
          update((p) => ({ ...p, onboarded: true }));
          navigate('/', { replace: true });
        }}
      >
        מתחילים מנמל היסודות
      </TactileButton>
      <TactileButton
        block
        tone="quiet"
        icon="bolt"
        onClick={() => {
          saveName();
          navigate('/placement');
        }}
      >
        אתגר מיון: 20 שאלות
      </TactileButton>
      <p className={styles.note}>באתגר המיון אפשר לפתוח ישר את יער ההרחבה.</p>
    </div>
  );
}
