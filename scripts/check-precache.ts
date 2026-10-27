/**
 * npm run check:precache (after a build)
 * The service worker's install must finish well inside the browsers' time limit for one event (a few minutes) even
 * on a slow phone connection, or it is cancelled and the game never works offline. So the precache stays small: no
 * audio (the page saves it, src/audio/offline-audio.ts), a bounded number of files and bytes.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_FILES = 150;
const MAX_BYTES = 8 * 1024 * 1024;

const dist = resolve(import.meta.dirname, '../dist');
const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
const urls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]!))];
const bytes = urls.reduce((sum, url) => sum + statSync(resolve(dist, url)).size, 0);
const audio = urls.filter((u) => u.endsWith('.mp3'));

const problems = [
  urls.length > MAX_FILES && `${urls.length} files (at most ${MAX_FILES})`,
  bytes > MAX_BYTES && `${(bytes / 1024 / 1024).toFixed(1)} MB (at most ${MAX_BYTES / 1024 / 1024} MB)`,
  audio.length > 0 && `${audio.length} audio clips (audio is saved by the page, not precached)`,
].filter(Boolean);
console.log(`Precache: ${urls.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB.`);
if (problems.length) {
  console.error(`The precache is too big for a reliable install: ${problems.join('; ')}.`);
  process.exit(1);
}
