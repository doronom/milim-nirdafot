import { audioPrefs } from './prefs';

/**
 * Reads Hebrew text aloud with the browser's speech engine (he-IL). Silent when no engine or voice is available, or
 * when the parent turned reading aloud off: the child never sees an audio error.
 */
export function speak(text: string): void {
  if (!audioPrefs.voice) return;
  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('he'));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    synth.speak(utterance);
  } catch {
    // No audio is fine.
  }
}
