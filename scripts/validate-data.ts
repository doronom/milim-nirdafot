import { content } from '../src/content';
import { MAX_GROUP_WORDS, validateContent, type Issue } from '../src/content/validate';

const report = validateContent(content);
const { stats } = report;
const titles = new Map(content.categories.map((c) => [c.id, c.title]));

const line = (s = '') => console.log(s);
const table = (rows: (string | number)[][]) => {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  for (const r of rows) line('  ' + r.map((c, i) => String(c).padEnd(widths[i]!)).join('  '));
};

line('Word Quest data validation');
line('==========================');
line(`entries: ${stats.entries}   unique words: ${stats.uniqueWords}   sentences: ${stats.other.sentences} (${stats.sentencesWithFits} with fits)`);
line(`intensity scales: ${stats.other.intensityScales}   register sets: ${stats.other.registerSets}   context choices: ${stats.other.contextChoices}   idioms: ${stats.other.idioms}`);
line(`reviewed items: ${stats.reviewed.reviewed}   unreviewed items: ${stats.reviewed.unreviewed}`);
line();
line('Per category');
table([
  ['category', 'booklet', 'expected', 'extra', 'custom', 'total'],
  ...Object.entries(stats.byCategory).map(([id, c]) => [
    `${id} (${titles.get(id) ?? ''})`,
    c.booklet,
    c.expected ?? '-',
    c.extra,
    c.custom,
    c.booklet + c.extra + c.custom,
  ]),
]);
line();
line('Per difficulty');
table([
  ['difficulty', 'booklet', 'extra', 'custom', 'all'],
  ...[1, 2, 3].map((d) => [d, ...['booklet', 'extra', 'custom', 'all'].map((s) => stats.byDifficulty[`${s}:${d}`] ?? 0)]),
]);
line();
line('Per source');
table([['source', 'entries'], ...Object.entries(stats.bySource)]);
line();
line('Per part of speech');
table([['pos', 'entries'], ...Object.entries(stats.byPos)]);
line();
line(`Synonym graph: ${stats.groups} groups. Largest 10 (max allowed ${MAX_GROUP_WORDS}; "#" marks a split sense):`);
for (const g of stats.largestGroups) line(`  ${g.size}: ${g.words.join(', ')}`);

const group = (issues: Issue[]) => {
  const byCode = new Map<string, Issue[]>();
  for (const i of issues) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);
  for (const [code, list] of byCode) {
    line(`  [${code}] x${list.length}`);
    for (const i of list) line(`    ${i.ref}: ${i.message}`);
  }
};
line();
line(`Warnings: ${report.warnings.length}`);
group(report.warnings);
line();
line(`Errors: ${report.errors.length}`);
group(report.errors);

process.exit(report.errors.length > 0 ? 1 : 0);
