/** The browser's speech engine (he-IL), resolving when the text has been read (or at once if there is none). */
export function browserSpeak(text: string): Promise<void> {
  return new Promise((done) => {
    try {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return done();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'he-IL';
      const voice = synth.getVoices?.().find((v) => v.lang.toLowerCase().startsWith('he'));
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onend = () => done();
      utterance.onerror = () => done();
      synth.speak(utterance);
      // Some engines never fire onend; never leave a sequence waiting.
      setTimeout(done, 1500 + text.length * 120);
    } catch {
      done();
    }
  });
}

export function stopBrowserSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}
