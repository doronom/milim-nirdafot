import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { setAudioPrefs } from '../audio/prefs';
import { addActivity } from '../engine/activity';
import { dayKey } from '../engine/dates';
import { useProgress } from './progress-context';

/** How often play time is added up, in seconds. */
export const ACTIVITY_TICK = 15;
/** Time without a touch or key after which the app counts as idle (left open, not played). */
const IDLE_AFTER_MS = 60_000;

/**
 * Counts the child's play time per day for the parent dashboard: only while the app is visible, outside the parent
 * area, and touched within the last minute. Also mirrors the audio settings for the audio helpers.
 */
export function useChildSession(): void {
  const { pathname } = useLocation();
  const { progress, update } = useProgress();
  const { voice = true, sound = true } = progress.settings;
  const tracking = !pathname.startsWith('/parent');

  useEffect(() => setAudioPrefs({ voice, sound }), [voice, sound]);

  useEffect(() => {
    if (!tracking) return;
    let lastInput = Date.now();
    const touched = () => {
      lastInput = Date.now();
    };
    window.addEventListener('pointerdown', touched);
    window.addEventListener('keydown', touched);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput > IDLE_AFTER_MS) return;
      update((p) => addActivity(p, dayKey(), ACTIVITY_TICK));
    }, ACTIVITY_TICK * 1000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
    };
  }, [tracking, update]);
}
