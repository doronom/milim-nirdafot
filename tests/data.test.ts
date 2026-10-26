import { describe, expect, it } from 'vitest';
import { buildContent, content, isSwapEligible, onlyReviewed, sources, type Entry } from '../src/content';
import { containsWord, normalizeWord, validateContent } from '../src/content/validate';

describe('content data', () => {
  const report = validateContent(content);

  it('has no validation errors', () => {
    expect(report.errors).toEqual([]);
  });

  it('keeps the booklet intact: 411 entries, 1,195 unique words, per-category counts', () => {
    const booklet = content.entries.filter((e) => e.source === 'booklet');
    expect(booklet).toHaveLength(411);
    const words = new Set(booklet.flatMap((e) => [e.headword, ...e.synonyms]));
    expect(words.size).toBe(1195);
    for (const c of sources.booklet.categories) {
      expect(booklet.filter((e) => e.categoryId === c.id)).toHaveLength(c.expectedCount!);
    }
  });

  it('keeps the booklet homograph hints', () => {
    const hints = (w: string) => content.entries.filter((e) => e.headword === w).map((e) => e.hint);
    expect(hints('ישן').sort()).toEqual(['במיטה', 'לא חדש']);
    expect(hints('קרא')).toEqual(['בספר']);
  });

  it('marks provenance on every item', () => {
    expect(content.entries.every((e) => (e.source === 'booklet') === e.reviewed)).toBe(true);
    const { extra } = sources;
    for (const x of [...extra.intensityScales, ...extra.registerSets, ...extra.contextChoices, ...extra.idioms]) {
      expect(x.source).toBe('extra');
      expect(x.reviewed).toBe(false);
    }
  });

  it('gives every headword one or two sentences', () => {
    const counts = new Map<string, number>();
    for (const s of content.sentences) counts.set(s.entryId, (counts.get(s.entryId) ?? 0) + 1);
    for (const e of content.entries) expect(counts.get(e.id), e.id).toBeGreaterThanOrEqual(1);
  });

  it('applies hint overrides without touching booklet.json', () => {
    const fear = content.entries.filter((e) => e.headword === 'פחד');
    expect(fear.map((e) => [e.pos, e.hint])).toEqual([
      ['noun', 'הרגש'],
      ['verb', 'הוא פחד מ…'],
    ]);
    expect(sources.booklet.entries.find((e) => e.id === 'b023')?.hint).toBeNull();
    expect(content.entries.find((e) => e.id === 'e063')?.hint).toBe('נתן כבוד');
  });

  it('marks the seven sentences without a fitting synonym as not swap-eligible', () => {
    const excluded = content.sentences.filter((s) => !isSwapEligible(s)).map((s) => s.entryId);
    expect(excluded.sort()).toEqual(['b268', 'b375', 'b378', 'b383', 'b391', 'b394', 'e070']);
  });

  it('filters to reviewed content only', () => {
    const reviewed = onlyReviewed(content);
    expect(reviewed.entries.every((e) => e.reviewed)).toBe(true);
    expect(reviewed.entries).toHaveLength(411);
    expect(reviewed.idioms).toHaveLength(0);
    expect(reviewed.sentences).toHaveLength(0);
  });

  it('adds custom words in a custom station and keeps them under reviewed-only', () => {
    const custom: Entry = {
      id: 'c001',
      categoryId: 'custom',
      headword: 'מגניב',
      hint: null,
      synonyms: ['אחלה'],
      difficulty: 1,
      pos: 'adj',
      source: 'custom',
      reviewed: false,
    };
    const merged = buildContent({ ...sources, custom: [custom] });
    expect(merged.categories.at(-1)?.id).toBe('custom');
    expect(onlyReviewed(merged).entries.some((e) => e.id === 'c001')).toBe(true);
  });
});

describe('validator', () => {
  it('fails when a hint equals a synonym or the headword', () => {
    const e = content.entries.find((x) => x.id === 'e063')!;
    for (const hint of ['הוקיר', 'העריך']) {
      const broken = { ...content, entries: content.entries.map((x) => (x.id === e.id ? { ...x, hint } : x)) };
      expect(validateContent(broken).errors.map((i) => i.code)).toContain('hint-gives-answer');
    }
  });

  it('warns (does not fail) on groups above 8 words, unless approved at their size', () => {
    // The five current large groups are approved, so start from an empty allowlist.
    expect(validateContent(content).warnings.filter((w) => w.code === 'group-large')).toEqual([]);
    const report = validateContent({ ...content, approvedLargeGroups: [] });
    const large = report.warnings.filter((w) => w.code === 'group-large');
    expect(large).toHaveLength(5);
    expect(large.length).toBeGreaterThan(0);
    const anchor = large[0]!.ref;
    const size = Number(/has (\d+) words/.exec(large[0]!.message)![1]);
    const approved = validateContent({ ...content, approvedLargeGroups: [{ anchor, maxSize: size }] });
    expect(approved.warnings.some((w) => w.ref === anchor && w.code === 'group-large')).toBe(false);
    const outgrown = validateContent({ ...content, approvedLargeGroups: [{ anchor, maxSize: size - 1 }] });
    expect(outgrown.warnings.some((w) => w.code === 'group-grew')).toBe(true);
  });

  it('fails on decision files that name unknown nodes or entries', () => {
    const broken = {
      ...content,
      alsoSynonyms: [{ a: 'אין כזה', b: 'טוב' }],
      notSynonyms: [{ targetId: 'zzz', distractor: 'טוב' }],
    };
    const codes = validateContent(broken).errors.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['also-synonym-unknown-node', 'not-synonym-unknown-target']));
  });

  it('fails when a sense split points at an item without the word', () => {
    const broken = {
      ...content,
      senseSplits: [
        ...content.senseSplits,
        {
          word: 'בית',
          senses: [
            { key: 'a', gloss: '', items: ['b001'] },
            { key: 'b', gloss: '', items: ['b300'] },
          ],
        },
      ],
    };
    expect(validateContent(broken).errors.map((i) => i.code)).toContain('sense-word-missing');
  });

  it('fails on duplicate headwords without distinct hints', () => {
    const broken = { ...content, entries: content.entries.map((x) => (x.id === 'b023' ? { ...x, hint: null } : x)) };
    expect(validateContent(broken).errors.map((i) => i.code)).toContain('homograph-without-hint');
  });

  it('flags a context answer missing from its options and a short scale', () => {
    const broken = {
      ...content,
      contexts: [{ ...content.contexts[0]!, answer: 'לא קיים' }],
      scales: [{ ...content.scales[0]!, weakToStrong: ['חם', 'לוהט'] }],
    };
    const codes = validateContent(broken).errors.map((e) => e.code);
    expect(codes).toContain('answer-not-in-options');
    expect(codes).toContain('short-scale');
  });

  it('flags duplicate ids, empty synonyms and stray characters', () => {
    const first = content.entries[0]!;
    const broken = {
      ...content,
      entries: [...content.entries, { ...first, synonyms: [] }, { ...first, id: 'x1', headword: 'אהבה!' }],
    };
    const codes = validateContent(broken).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(['duplicate-id', 'empty-synonyms', 'stray-character']));
  });

  it('matches whole words behind Hebrew prefixes', () => {
    expect(containsWord('הוא רעד מפחד כשהאורות כבו.', 'פחד')).toBe(true);
    expect(containsWord('הקבוצה שלנו ניצחה.', 'קבוצה')).toBe(true);
    expect(containsWord('אני אסיר תודה לך.', 'אסיר תודה')).toBe(true);
    expect(containsWord('הכלב שלי', 'כל')).toBe(false);
  });

  it('normalizes niqqud and a trailing maqaf', () => {
    expect(normalizeWord('רֵעַ')).toBe('רע');
    expect(normalizeWord('זכה ב־')).toBe('זכה ב');
  });
});
