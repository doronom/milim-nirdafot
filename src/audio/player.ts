import { Howl } from 'howler';
import { stripNiqqud } from '../content/text';
import manifest from '../generated/audio-manifest.json';
import { audioPrefs } from './prefs';
import { browserSpeak, stopBrowserSpeech } from './web-speech';

const clips = (manifest as { clips: Record<string, string> }).clips;
/** A displayed word may have lost its niqqud (רע for רֵעַ): find its clip by the bare spelling when that is unique. */
const bare = new Map<string, string | null>();
for (const [text, file] of Object.entries(clips)) {
  const key = stripNiqqud(text);
  bare.set(key, bare.has(key) && bare.get(key) !== file ? null : file);
}

export function clipUrl(text: string): string | undefined {
  const t = text.trim();
  const file = clips[t] ?? bare.get(stripNiqqud(t)) ?? undefined;
  return file ? `${import.meta.env.BASE_URL}audio/${file}` : undefined;
}

export type Spoken = string | { recording: Blob };

let session = 0;
let current: Howl | null = null;

function playUrl(src: string, format?: string): Promise<boolean> {
  return new Promise((done) => {
    const howl = new Howl({
      src: [src],
      format: format ? [format] : ['mp3'],
      html5: false,
      onend: () => done(true),
      onloaderror: () => done(false),
      onplayerror: () => done(false),
    });
    current = howl;
    howl.play();
  });
}

async function playOne(item: Spoken): Promise<void> {
  if (typeof item !== 'string') {
    const url = URL.createObjectURL(item.recording);
    const format = item.recording.type.split('/')[1]?.split(';')[0];
    await playUrl(url, format);
    URL.revokeObjectURL(url);
    return;
  }
  const url = clipUrl(item);
  // A missing or unplayable clip falls back to the browser voice.
  if (url && (await playUrl(url))) return;
  await browserSpeak(item);
}

/**
 * Reads texts aloud one after another: the parent's recording, a generated clip, or the browser voice, in that order
 * of preference. A new call stops the previous one. Silent when reading aloud is off.
 */
export async function say(items: Spoken | readonly Spoken[]): Promise<void> {
  const id = ++session;
  current?.stop();
  stopBrowserSpeech();
  if (!audioPrefs.voice) return;
  for (const item of Array.isArray(items) ? items : [items]) {
    if (id !== session) return;
    try {
      await playOne(item as Spoken);
    } catch {
      // Audio never interrupts the game.
    }
  }
}
