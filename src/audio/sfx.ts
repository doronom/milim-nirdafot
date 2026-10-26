import { useEffect } from 'react';
import { audioPrefs } from './prefs';

export type Sfx = 'correct' | 'wrong' | 'complete';

/** Notes (Hz) and length (s) per effect: short, soft and never harsh, so a wrong answer does not sound like a buzzer. */
const NOTES: Record<Sfx, { freqs: number[]; step: number; type: OscillatorType; gain: number }> = {
  correct: { freqs: [660, 990], step: 0.09, type: 'triangle', gain: 0.18 },
  wrong: { freqs: [330, 262], step: 0.12, type: 'sine', gain: 0.14 },
  complete: { freqs: [523, 659, 784, 1047], step: 0.11, type: 'triangle', gain: 0.18 },
};

let context: AudioContext | null = null;

/** Plays a sound effect with Web Audio (no files to download). Silent when sound is off or audio is unavailable. */
export function playSfx(kind: Sfx): void {
  if (!audioPrefs.sound) return;
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    const ctx = context;
    if (ctx.state === 'suspended') void ctx.resume();
    const { freqs, step, type, gain } = NOTES[kind];
    freqs.forEach((freq, i) => {
      const start = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0, start);
      amp.gain.linearRampToValueAtTime(gain, start + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + step * 1.8);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + step * 2);
    });
  } catch {
    // No sound is fine.
  }
}

/** Plays an effect once when a component appears (an answer drawer, a result screen). */
export function useSfx(kind: Sfx | null): void {
  useEffect(() => {
    if (kind) playSfx(kind);
  }, [kind]);
}
