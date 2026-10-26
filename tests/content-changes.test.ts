import { describe, expect, it } from 'vitest';
import { sources } from '../src/content';
import { applyContentChanges, buildContentChanges, parseContentChanges } from '../src/content/content-changes';
import { customEntry, upsertCustom, withEdit } from '../src/content/edits';
import { buildContent } from '../src/content/model';
import { applyOverrides, emptyOverrides, playable } from '../src/content/overrides';
import { validateContent } from '../src/content/validate';
import { buildSynonymGraph } from '../src/engine/graph';

const base = buildContent(sources);
/** גדול is split into senses, so its node is "גדול#...": take it from the graph, as the app does. */
const big = buildSynonymGraph(base).headwordNode(base.entries.find((e) => e.id === 'b031')!);
const word = customEntry('c-1', {
  headword: 'ענווה',
  synonyms: ['צניעות', 'פשטות'],
  hint: null,
  pos: 'noun',
  difficulty: 1,
});

function overrides() {
  let ov = emptyOverrides();
  ov = withEdit(ov, base, 'entries', 'b031', { synonyms: ['ענק', 'עצום'] });
  ov = withEdit(ov, base, 'entries', 'b035', { hint: 'בטמפרטורה' });
  ov = withEdit(ov, base, 'entries', 'e001', { difficulty: 3 });
  ov = withEdit(ov, base, 'scales', 'scale01', { hidden: true });
  ov = upsertCustom(ov, word);
  return { ...ov, decisions: { e002: 'approved' as const, idiom01: 'rejected' as const } };
}

const changes = () =>
  buildContentChanges(
    overrides(),
    {
      alsoSynonyms: [
        { a: big, b: 'ענק', note: 'reported in pickSynonym' },
        { a: 'חרד', b: 'מתוח#tense' },
      ],
      notSynonyms: [{ targetId: 'b031', distractor: 'רחב' }],
    },
    [{ sentenceId: 'sent-b031-1', status: 'kept' }],
    [{ itemKey: 'scale02', answer: 'חם', status: 'accepted' }],
    new Date('2026-10-26T10:00:00Z'),
  );

describe('export content changes', () => {
  it('writes one file with edits, custom words, decisions, also- and not-synonyms', () => {
    const file = changes();
    expect(file.format).toBe('word-quest-content-changes');
    expect(file.edits.entries.b031).toEqual({ synonyms: ['ענק', 'עצום'] });
    expect(file.custom).toHaveLength(1);
    expect(file.decisions).toEqual({ e002: 'approved', idiom01: 'rejected' });
    expect(file.alsoSynonyms).toHaveLength(2);
    expect(file.notSynonyms).toHaveLength(1);
    expect(parseContentChanges(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it('refuses a file that is not an export', () => {
    expect(() => parseContentChanges({ format: 'word-quest-backup' })).toThrow();
    expect(() => parseContentChanges(null)).toThrow();
  });
});

describe('apply content changes', () => {
  const next = applyContentChanges(sources, changes());
  const merged = buildContent(next);

  it('folds the changes into the data files and the result passes validation', () => {
    expect(validateContent(merged).errors).toEqual([]);
    const b031 = next.booklet.entries.find((e) => e.id === 'b031')!;
    expect(b031.synonyms).toEqual(['ענק', 'עצום']);
    // Booklet hints live in senses.json; the booklet keeps its printed hint field.
    expect(next.booklet.entries.find((e) => e.id === 'b035')!.hint).toBeNull();
    expect(next.senses.hints.b035).toBe('בטמפרטורה');
    expect(next.extra.newEntries.find((e) => e.id === 'e001')!.difficulty).toBe(3);
    expect(next.extra.newEntries.find((e) => e.id === 'e002')!.reviewed).toBe(true);
    expect(next.extra.idioms.find((i) => i.id === 'idiom01')!.hidden).toBe(true);
    expect(next.extra.intensityScales.find((s) => s.id === 'scale01')!.hidden).toBe(true);
    expect(next.sentences.sentences.find((s) => s.id === 'sent-b031-1')!.reviewed).toBe(true);
    expect(next.custom).toEqual([word]);
  });

  it('gives the same played content as the in-app override layer', () => {
    const inApp = playable(applyOverrides(base, overrides(), changes()));
    const fromFiles = playable(merged);
    const pick = (c: typeof inApp) => ({
      entries: c.entries.map((e) => [e.id, e.headword, e.hint, e.synonyms, e.difficulty, e.reviewed]),
      scales: c.scales.map((s) => s.id),
      idioms: c.idioms.map((i) => i.id),
    });
    expect(pick(fromFiles)).toEqual(pick(inApp));
  });

  it('adds decided pairs once, and does not modify its inputs', () => {
    expect(next.alsoSynonyms.pairs.filter((p) => p.a === big)).toHaveLength(1);
    // מתוח#tense ~ חרד is already in the file (in the other order).
    expect(next.alsoSynonyms.pairs).toHaveLength(sources.alsoSynonyms.pairs.length + 1);
    expect(next.notSynonyms.pairs).toEqual([{ targetId: 'b031', distractor: 'רחב' }]);
    expect(sources.booklet.entries.find((e) => e.id === 'b031')!.synonyms).toEqual(['ענק', 'עצום', 'כביר']);
    expect(applyContentChanges(next, changes()).alsoSynonyms.pairs).toHaveLength(next.alsoSynonyms.pairs.length);
  });

  it('a removed sentence report hides the sentence', () => {
    const file = { ...changes(), sentenceReports: [{ sentenceId: 'sent-b031-1', status: 'removed' as const }] };
    expect(applyContentChanges(sources, file).sentences.sentences.find((s) => s.id === 'sent-b031-1')!.hidden).toBe(
      true,
    );
  });
});
