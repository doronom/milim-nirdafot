import { describe, expect, it } from 'vitest';
import { bookletFile, buildContent, content, extraFile, onlyReviewed, sentencesFile, type Entry } from '../src/content';
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
    for (const c of bookletFile.categories) {
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
    for (const x of [...extraFile.intensityScales, ...extraFile.registerSets, ...extraFile.contextChoices, ...extraFile.idioms]) {
      expect(x.source).toBe('extra');
      expect(x.reviewed).toBe(false);
    }
  });

  it('gives every headword one or two sentences', () => {
    const counts = new Map<string, number>();
    for (const s of content.sentences) counts.set(s.entryId, (counts.get(s.entryId) ?? 0) + 1);
    for (const e of content.entries) expect(counts.get(e.id), e.id).toBeGreaterThanOrEqual(1);
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
      id: 'c001', categoryId: 'custom', headword: 'מגניב', hint: null, synonyms: ['אחלה'],
      difficulty: 1, pos: 'adj', source: 'custom', reviewed: false,
    };
    const merged = buildContent(bookletFile, extraFile, sentencesFile, [custom]);
    expect(merged.categories.at(-1)?.id).toBe('custom');
    expect(onlyReviewed(merged).entries.some((e) => e.id === 'c001')).toBe(true);
  });
});

describe('validator', () => {
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
