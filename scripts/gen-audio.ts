/**
 * npm run gen:audio
 * Generates an MP3 for every text the game reads aloud, with the voice in scripts/tts/config.json, into public/audio/,
 * and writes src/generated/audio-manifest.json (text -> file). File names hash the voice, pace and text, so only
 * new or changed texts are synthesized; files nothing points to any more are deleted. Run locally (needs
 * GOOGLE_TTS_API_KEY in .env) and commit the MP3s and the manifest; CI never calls the API.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clipTexts } from '../src/audio/clips';
import { content } from '../src/content';
import { pool, synthesize } from './tts/google';

const root = resolve(import.meta.dirname, '..');
const AUDIO = resolve(root, 'public/audio');
const MANIFEST = resolve(root, 'src/generated/audio-manifest.json');
const config = JSON.parse(readFileSync(resolve(import.meta.dirname, 'tts/config.json'), 'utf8')) as {
  voice: string | null;
  speakingRate: number;
};
const voice = process.argv[2] ?? config.voice;
if (!voice) {
  console.error('No voice chosen yet: set "voice" in scripts/tts/config.json (see npm run tts:compare).');
  process.exit(2);
}
const rate = config.speakingRate;

const fileFor = (text: string) =>
  `${createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex').slice(0, 16)}.mp3`;

mkdirSync(AUDIO, { recursive: true });
const texts = clipTexts(content);
const clips: Record<string, string> = {};
const todo = new Map<string, string>();
for (const text of texts) {
  const file = fileFor(text);
  clips[text] = file;
  if (!existsSync(resolve(AUDIO, file))) todo.set(file, text);
}

console.log(`${texts.length} texts, ${todo.size} to synthesize with ${voice}`);
let done = 0;
const failed: string[] = [];
await pool([...todo], 4, async ([file, text]) => {
  try {
    writeFileSync(resolve(AUDIO, file), await synthesize(text, { voice, speakingRate: rate }));
  } catch (e) {
    failed.push(`${text}: ${(e as Error).message}`);
  }
  if (++done % 100 === 0) console.log(`  ${done}/${todo.size}`);
});

const used = new Set(Object.values(clips));
let removed = 0;
for (const f of readdirSync(AUDIO))
  if (f.endsWith('.mp3') && !used.has(f)) {
    unlinkSync(resolve(AUDIO, f));
    removed++;
  }

// A text whose synthesis failed stays out of the manifest, so the game falls back to the browser voice for it.
const ok = Object.fromEntries(Object.entries(clips).filter(([, f]) => existsSync(resolve(AUDIO, f))));
writeFileSync(MANIFEST, `${JSON.stringify({ voice, speakingRate: rate, clips: ok }, null, 2)}\n`);
const bytes = [...used]
  .filter((f) => existsSync(resolve(AUDIO, f)))
  .reduce((s, f) => s + statSync(resolve(AUDIO, f)).size, 0);
console.log(`Synthesized ${todo.size - failed.length}, removed ${removed}, total ${(bytes / 1e6).toFixed(1)} MB.`);
if (failed.length > 0) {
  console.error(`${failed.length} failed:\n  ${failed.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
