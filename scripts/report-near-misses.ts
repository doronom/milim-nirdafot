import { mkdirSync, writeFileSync } from 'node:fs';
import { content } from '../src/content';
import type { Entry } from '../src/content/types';
import { rankNearMisses, trapKeys, type NearMiss } from '../src/engine/distractors';
import { buildSynonymGraph } from '../src/engine/graph';

/**
 * Writes two review files:
 * - reports/near-misses.csv: the top tier 3 candidates per entry (full report);
 * - reports/near-misses-top50.csv: the 50 highest-scoring pairs that can actually be offered in World 1-2, one row per
 *   unordered pair, for a quick review.
 * Confirm a fair trap by adding { targetId, distractor } to src/data/not-synonyms.json;
 * mark a real synonym by adding { a, b } node ids to src/data/also-synonyms.json.
 */
const TOP = Number(process.argv[2] ?? 5);
const graph = buildSynonymGraph(content);
const decisions = { confirmedTraps: trapKeys(content.notSynonyms) };
const titles = new Map(content.categories.map((c) => [c.id, c.title]));

type Row = (string | number)[];
const header: Row = ['target', 'targetId', 'targetNode', 'distractor', 'distractorNode', 'category', 'score', 'status'];
const toRow = (target: Entry, nm: NearMiss): Row => [
  target.hint ? `${target.headword} (${target.hint})` : target.headword,
  target.id,
  graph.headwordNode(target),
  nm.word,
  nm.nodeId,
  titles.get(target.categoryId) ?? target.categoryId,
  nm.score.toFixed(2),
  nm.status,
];

const rows: Row[] = [];
const counts: Record<string, number> = {};
// World 1-2 stations are the booklet categories, holding the booklet and extra entries.
const pairs = new Map<string, { score: number; row: Row }>();
for (const target of content.entries) {
  const ranked = rankNearMisses(graph, target, content.entries, decisions);
  for (const nm of ranked.slice(0, TOP)) {
    counts[nm.status] = (counts[nm.status] ?? 0) + 1;
    rows.push(toRow(target, nm));
  }
  if (target.source === 'custom') continue;
  for (const nm of ranked.filter((n) => n.status === 'eligible')) {
    const key = [target.headword, nm.word].sort().join('|');
    const prev = pairs.get(key);
    if (!prev || prev.score < nm.score) pairs.set(key, { score: nm.score, row: toRow(target, nm) });
  }
}
const top50 = [...pairs.values()]
  .sort((a, b) => b.score - a.score || String(a.row[0]).localeCompare(String(b.row[0])))
  .slice(0, 50)
  .map((p) => p.row);

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// BOM so spreadsheet apps open the Hebrew as UTF-8.
const toCsv = (table: Row[]) => '﻿' + table.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

mkdirSync('reports', { recursive: true });
writeFileSync('reports/near-misses.csv', toCsv([header, ...rows]));
writeFileSync('reports/near-misses-top50.csv', toCsv([header, ...top50]));
console.log(`reports/near-misses.csv: ${rows.length} rows (top ${TOP} per entry)`, counts);
console.log(`reports/near-misses-top50.csv: ${top50.length} rows`);
