import { mkdirSync, writeFileSync } from 'node:fs';
import { content } from '../src/content';
import { rankNearMisses, trapKeys } from '../src/engine/distractors';
import { buildSynonymGraph } from '../src/engine/graph';

/**
 * Writes reports/near-misses.csv: the top tier 3 candidates per entry, for review.
 * Confirm a fair trap by adding { targetId, distractor } to src/data/not-synonyms.json;
 * mark a real synonym by adding { a, b } node ids to src/data/also-synonyms.json.
 */
const TOP = Number(process.argv[2] ?? 5);
const graph = buildSynonymGraph(content);
const decisions = { confirmedTraps: trapKeys(content.notSynonyms) };
const titles = new Map(content.categories.map((c) => [c.id, c.title]));

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows: (string | number)[][] = [['target', 'targetId', 'targetNode', 'distractor', 'distractorNode', 'category', 'score', 'status']];
const counts: Record<string, number> = {};
for (const target of content.entries) {
  for (const nm of rankNearMisses(graph, target, content.entries, decisions).slice(0, TOP)) {
    counts[nm.status] = (counts[nm.status] ?? 0) + 1;
    rows.push([
      target.hint ? `${target.headword} (${target.hint})` : target.headword,
      target.id,
      graph.headwordNode(target),
      nm.word,
      nm.nodeId,
      titles.get(target.categoryId) ?? target.categoryId,
      nm.score.toFixed(2),
      nm.status,
    ]);
  }
}
mkdirSync('reports', { recursive: true });
// BOM so spreadsheet apps open the Hebrew as UTF-8.
writeFileSync('reports/near-misses.csv', '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
console.log(`reports/near-misses.csv: ${rows.length - 1} rows (top ${TOP} per entry)`, counts);
