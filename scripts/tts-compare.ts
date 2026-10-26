/**
 * npm run tts:compare
 * Builds reports/voice-compare/index.html: 8 sample words and 2 sentences in every he-IL Google voice, next to the
 * browser's own Web Speech voices, for choosing the game's voice. Output is local (reports/ is not committed).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content } from '../src/content';
import { hebrewVoices, pool, synthesize, voiceFamily } from './tts/google';

const OUT = resolve(import.meta.dirname, '../reports/voice-compare');

// Everyday words, words whose reading depends on context (ישן, קרא), a pointed word (רֵעַ) and a two-word phrase.
const WORDS = ['שמח', 'מפוחד', 'זריז', 'ישן', 'קרא', 'התלהב', 'רֵעַ', 'קל רגליים'];
const known = new Set(content.entries.flatMap((e) => [e.headword, ...e.synonyms]));
const words = WORDS.filter((w) => known.has(w));
const sentences = [content.sentences.find((s) => s.id === 'sent-b031-1')!.text, content.idioms[0]!.example];
const samples = [
  ...words.map((text) => ({ kind: 'word', text })),
  ...sentences.map((text) => ({ kind: 'sentence', text })),
];

const voices = await hebrewVoices();
if (voices.length === 0) throw new Error('No he-IL voices returned');
console.log(`${voices.length} he-IL voices: ${voices.map((v) => v.name).join(', ')}`);

// Clips already made are kept, so a run interrupted by rate limits only fills in what is missing.
mkdirSync(OUT, { recursive: true });
const jobs = voices.flatMap((v) =>
  samples.map((s, i) => ({ voice: v.name, text: s.text, file: `${v.name}-${i}.mp3` })),
);
const failed = new Map<string, string>();
await pool(jobs, 4, async (job) => {
  if (existsSync(resolve(OUT, job.file))) return;
  try {
    writeFileSync(resolve(OUT, job.file), await synthesize(job.text, { voice: job.voice }));
  } catch (e) {
    failed.set(job.voice, (e as Error).message);
  }
});

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const families = [...new Set(voices.map((v) => voiceFamily(v.name)))];
const gender = (g: string) => (g === 'FEMALE' ? 'קול נשי' : g === 'MALE' ? 'קול גברי' : 'קול');
const head = `<tr><th>קול</th>${samples.map((s) => `<th class="${s.kind}">${esc(s.text)}</th>`).join('')}</tr>`;
const rows = (family: string) =>
  voices
    .filter((v) => voiceFamily(v.name) === family)
    .map(
      (v) =>
        `<tr><th><span class="name">${v.name.replace('he-IL-', '')}</span><span class="meta">${gender(v.ssmlGender)}</span>${
          failed.has(v.name) ? `<span class="err">${esc(failed.get(v.name)!)}</span>` : ''
        }</th>${samples
          .map((_, i) =>
            failed.has(v.name)
              ? '<td></td>'
              : `<td><audio controls preload="none" src="${v.name}-${i}.mp3"></audio></td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>השוואת קולות</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f5; --card: #fff; --text: #1d1d1f; --muted: #6b6b70; --line: #e3e3e0; --accent: #0b6bcb; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111317; --card: #1a1d23; --text: #ececf0; --muted: #9a9aa3; --line: #2b2f37; --accent: #5aa9ff; } }
  body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 28px 0 8px; }
  p { color: var(--muted); margin: 0 0 12px; }
  .scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
  table { border-collapse: collapse; min-width: 100%; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: start; vertical-align: middle; }
  thead th { font-weight: 600; white-space: nowrap; font-size: 14px; }
  thead th.sentence { white-space: normal; min-width: 220px; font-weight: 400; color: var(--muted); }
  tbody th { white-space: nowrap; }
  .name { display: block; font-weight: 600; direction: ltr; text-align: right; }
  .meta { display: block; color: var(--muted); font-size: 13px; }
  .err { display: block; color: #c0392b; font-size: 12px; max-width: 240px; white-space: normal; }
  audio { width: 150px; height: 32px; }
  button { font: inherit; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; }
  button:hover { border-color: var(--accent); }
  #ws-none { color: var(--muted); padding: 12px; }
</style>
</head>
<body>
<main>
<h1>השוואת קולות לעברית</h1>
<p>${words.length} מילים ו־${sentences.length} משפטים בכל קול עברי של Google Cloud Text-to-Speech (${voices.length} קולות), ולמטה הקולות של הדפדפן הזה (Web Speech). בחרו קול ושלחו את שמו.</p>
${families.map((f) => `<h2>${f}</h2><div class="scroll"><table><thead>${head}</thead><tbody>${rows(f)}</tbody></table></div>`).join('\n')}
<h2>Web Speech (הקול המובנה בדפדפן)</h2>
<p>זה הקול שהמשחק משתמש בו היום כשאין הקלטה. הוא משתנה בין מכשירים ודפדפנים.</p>
<div class="scroll"><table><thead>${head}</thead><tbody id="ws"></tbody></table><div id="ws-none" hidden>בדפדפן הזה אין קול עברי של Web Speech.</div></div>
</main>
<script>
  const samples = ${JSON.stringify(samples.map((s) => s.text))};
  function fill() {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('he'));
    const body = document.getElementById('ws');
    document.getElementById('ws-none').hidden = voices.length > 0;
    body.innerHTML = '';
    for (const v of voices) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.innerHTML = '<span class="name"></span><span class="meta"></span>';
      th.querySelector('.name').textContent = v.name;
      th.querySelector('.meta').textContent = v.localService ? 'במכשיר' : 'ברשת';
      tr.append(th);
      samples.forEach((text) => {
        const td = document.createElement('td');
        const b = document.createElement('button');
        b.textContent = 'השמעה';
        b.onclick = () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; speechSynthesis.speak(u); };
        td.append(b);
        tr.append(td);
      });
      body.append(tr);
    }
  }
  if ('speechSynthesis' in window) { fill(); speechSynthesis.onvoiceschanged = fill; } else document.getElementById('ws-none').hidden = false;
</script>
</body>
</html>
`;
writeFileSync(resolve(OUT, 'index.html'), html);
console.log(
  `Wrote ${resolve(OUT, 'index.html')} (${jobs.length - [...failed.keys()].length * samples.length} clips${failed.size ? `, ${failed.size} voices failed` : ''})`,
);
