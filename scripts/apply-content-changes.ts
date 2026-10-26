import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sources } from '../src/content';
import { applyContentChanges, parseContentChanges } from '../src/content/content-changes';
import { buildContent } from '../src/content/model';
import { validateContent } from '../src/content/validate';

/**
 * npm run apply:content-changes <file>
 * Folds a "content changes" export from the parent area into src/data. The merged data is validated in memory first;
 * nothing is written if it has errors. Then validate:data runs on the written files.
 */
const file = process.argv[2];
if (!file) {
  console.error('usage: npm run apply:content-changes <content-changes.json>');
  process.exit(2);
}

const changes = parseContentChanges(JSON.parse(readFileSync(resolve(file), 'utf8')));
const next = applyContentChanges(sources, changes);
const { errors } = validateContent(buildContent(next));
if (errors.length > 0) {
  console.error(`Not applied: the merged data has ${errors.length} validation error(s):`);
  for (const e of errors) console.error(`  [${e.code}] ${e.ref}: ${e.message}`);
  process.exit(1);
}

const data = (name: string) => resolve(import.meta.dirname, '../src/data', name);
const files: [string, unknown, unknown][] = [
  ['booklet.json', next.booklet, sources.booklet],
  ['synonyms-extra.json', next.extra, sources.extra],
  ['sentences.json', next.sentences, sources.sentences],
  ['senses.json', next.senses, sources.senses],
  ['also-synonyms.json', next.alsoSynonyms, sources.alsoSynonyms],
  ['not-synonyms.json', next.notSynonyms, sources.notSynonyms],
  ['custom-words.json', next.custom ?? [], sources.custom],
];
// Only files whose content changed are rewritten, so the diff shows just the parent's changes.
const changed = files.filter(([, json, before]) => JSON.stringify(json) !== JSON.stringify(before));
for (const [name, json] of changed) writeFileSync(data(name), `${JSON.stringify(json, null, 2)}\n`);
if (changed.length > 0)
  spawnSync('npx', ['prettier', '--log-level', 'warn', '--write', ...changed.map(([n]) => data(n))], {
    stdio: 'inherit',
  });
console.log(`Files written: ${changed.map(([n]) => n).join(', ') || 'none'}`);

const counts = Object.fromEntries(Object.entries(changes.edits).map(([k, v]) => [k, Object.keys(v).length]));
console.log(
  `Applied ${file}: edits ${JSON.stringify(counts)}, ${changes.custom.length} custom words, ` +
    `${Object.keys(changes.decisions).length} review decisions, ${changes.alsoSynonyms.length} also-synonyms, ` +
    `${changes.notSynonyms.length} not-synonyms, ${changes.sentenceReports.length} sentence decisions.`,
);
if (changes.itemDisputes.length > 0) {
  console.log('Item disputes to look at by hand (not applied automatically):');
  for (const d of changes.itemDisputes) console.log(`  ${d.status}: ${d.itemKey} -> ${d.answer}`);
}
const validate = spawnSync('npx', ['tsx', resolve(import.meta.dirname, 'validate-data.ts')], { stdio: 'inherit' });
process.exit(validate.status ?? 1);
