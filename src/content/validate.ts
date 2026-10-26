import type { Content, Entry } from './types';
import { POS_VALUES } from './types';

export interface Issue {
  code: string;
  ref: string;
  message: string;
}

export interface ValidationReport {
  errors: Issue[];
  warnings: Issue[];
  stats: ContentStats;
}

export interface ContentStats {
  entries: number;
  uniqueWords: number;
  byCategory: Record<string, { booklet: number; extra: number; custom: number; expected?: number }>;
  byDifficulty: Record<string, number>;
  bySource: Record<string, number>;
  byPos: Record<string, number>;
  reviewed: { reviewed: number; unreviewed: number };
  other: Record<string, number>;
  sentencesWithFits: number;
  /** Naive synonym groups (word strings, hints ignored): a preview for the step 2 graph. */
  largestGroups: { size: number; sample: string[] }[];
}

const HEB_LETTER = '\u05D0-\u05EA';
// Cantillation and vowel points, excluding the maqaf (U+05BE).
const NIQQUD = /[\u0591-\u05BD\u05BF-\u05C7]/g;
const HAS_NIQQUD = /[\u0591-\u05BD\u05BF-\u05C7]/;
/** Words: Hebrew letters, single inner spaces, maqaf, and niqqud (flagged separately). */
const WORD_OK = /^[\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7]+(?:[ \u05BE][\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7]+)*\u05BE?$/;
/** Free text (sentences, explanations): words plus everyday punctuation. */
const TEXT_OK = /^[\u05D0-\u05EA\u0591-\u05C7 ,.!?:;"'\-\u2013=()0-9]+$/;
const PREFIXES = '[ובכלמשה]{0,3}';

export const stripNiqqud = (s: string): string => s.replace(NIQQUD, '');
/** The comparison form of a word: no niqqud, no trailing maqaf, trimmed. */
export const normalizeWord = (s: string): string => stripNiqqud(s).replace(/־$/, '').trim();

/** True when `text` contains `word` as a whole word, optionally behind one-letter prefixes (ו, ה, ב, ל, מ, ש, כ). */
export function containsWord(text: string, word: string): boolean {
  const escaped = normalizeWord(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^${HEB_LETTER}])${PREFIXES}${escaped}($|[^${HEB_LETTER}])`);
  return re.test(stripNiqqud(text));
}

export function validateContent(content: Content): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (code: string, ref: string, message: string) => errors.push({ code, ref, message });
  const warn = (code: string, ref: string, message: string) => warnings.push({ code, ref, message });

  // Duplicate ids across every item type.
  const allIds = [
    ...content.categories.map((c) => `category:${c.id}`),
    ...[...content.entries, ...content.scales, ...content.registers, ...content.contexts, ...content.idioms, ...content.sentences].map(
      (x) => x.id,
    ),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) err('duplicate-id', id, 'duplicate id');
    seen.add(id);
  }

  const checkWord = (ref: string, w: string) => {
    if (w !== w.trim() || /\s{2,}/.test(w)) err('stray-whitespace', ref, `"${w}" has extra whitespace`);
    else if (!WORD_OK.test(w)) err('stray-character', ref, `"${w}" contains unexpected characters`);
    if (HAS_NIQQUD.test(w)) warn('niqqud', ref, `"${w}" carries niqqud; compared without it`);
    if (/־$/.test(w) || /(^| )[בלמ]$/.test(w)) warn('dangling-preposition', ref, `"${w}" ends with a bare preposition`);
  };
  const checkText = (ref: string, t: string) => {
    if (!TEXT_OK.test(t)) err('stray-character', ref, `text contains unexpected characters: "${t}"`);
    if (t !== t.trim() || /\s{2,}/.test(t)) err('stray-whitespace', ref, 'text has extra whitespace');
  };

  // Entries.
  const categoryIds = new Set(content.categories.map((c) => c.id));
  const entriesById = new Map<string, Entry>();
  const headwordKeys = new Map<string, Entry[]>();
  for (const e of content.entries) {
    entriesById.set(e.id, e);
    if (!categoryIds.has(e.categoryId)) err('unknown-category', e.id, `unknown category "${e.categoryId}"`);
    if (![1, 2, 3].includes(e.difficulty)) err('bad-difficulty', e.id, `difficulty must be 1-3, got ${String(e.difficulty)}`);
    if (!POS_VALUES.includes(e.pos)) err('bad-pos', e.id, `unknown part of speech "${String(e.pos)}"`);
    if (e.synonyms.length === 0) err('empty-synonyms', e.id, `"${e.headword}" has no synonyms`);
    checkWord(e.id, e.headword);
    e.synonyms.forEach((s) => checkWord(e.id, s));
    if (e.hint !== null) checkText(e.id, e.hint);
    const norm = e.synonyms.map(normalizeWord);
    if (new Set(norm).size !== norm.length) err('duplicate-synonym', e.id, `"${e.headword}" lists a synonym twice`);
    if (norm.includes(normalizeWord(e.headword))) err('self-synonym', e.id, `"${e.headword}" lists itself as a synonym`);
    if (e.hint !== null && norm.includes(normalizeWord(e.hint))) {
      warn('hint-gives-answer', e.id, `hint "${e.hint}" of "${e.headword}" is also one of its synonyms`);
    }
    const key = normalizeWord(e.headword);
    headwordKeys.set(key, [...(headwordKeys.get(key) ?? []), e]);
  }
  for (const [word, list] of headwordKeys) {
    if (list.length < 2) continue;
    const hints = list.map((e) => e.hint ?? '');
    if (new Set(hints).size !== hints.length) {
      warn('homograph-without-hint', list.map((e) => e.id).join(','), `headword "${word}" appears ${list.length} times without distinct hints`);
    }
  }

  // Hinted headwords whose plain spelling also appears as someone else's synonym: the graph must not join them blindly.
  const hinted = content.entries.filter((e) => e.hint !== null);
  for (const h of hinted) {
    const key = normalizeWord(h.headword);
    const users = content.entries.filter((e) => e.id !== h.id && e.synonyms.some((s) => normalizeWord(s) === key));
    if (users.length > 0) {
      warn('homograph-synonym', h.id, `"${h.headword}" (${h.hint}) also appears as a synonym of ${users.map((u) => `${u.headword} [${u.id}]`).join(', ')}`);
    }
  }

  // The same spelling used by entries of different parts of speech is usually a homograph (ערב, חמה, נוגה...).
  const posByWord = new Map<string, Map<string, string[]>>();
  for (const e of content.entries) {
    for (const w of [e.headword, ...e.synonyms].map(normalizeWord)) {
      const m = posByWord.get(w) ?? new Map<string, string[]>();
      m.set(e.pos, [...(m.get(e.pos) ?? []), e.id]);
      posByWord.set(w, m);
    }
  }
  for (const [w, m] of posByWord) {
    if (m.size < 2) continue;
    const detail = [...m].map(([pos, ids]) => `${pos}: ${ids.join(',')}`).join(' | ');
    warn('cross-pos-word', w, `"${w}" is shared across parts of speech (${detail})`);
  }

  // Booklet category counts.
  for (const c of content.categories) {
    if (c.expectedCount === undefined) continue;
    const n = content.entries.filter((e) => e.categoryId === c.id && e.source === 'booklet').length;
    if (n !== c.expectedCount) err('category-count', c.id, `expected ${c.expectedCount} booklet entries, found ${n}`);
  }

  // Intensity scales.
  for (const s of content.scales) {
    if (s.weakToStrong.length < 3) err('short-scale', s.id, `scale "${s.theme}" has ${s.weakToStrong.length} words (needs 3+)`);
    s.weakToStrong.forEach((w) => checkWord(s.id, w));
    if (new Set(s.weakToStrong).size !== s.weakToStrong.length) err('duplicate-word', s.id, 'scale repeats a word');
  }

  // Register sets.
  for (const r of content.registers) {
    const words = [...r.everyday, ...r.standard, ...r.literary];
    words.forEach((w) => checkWord(r.id, w));
    const filled = [r.everyday, r.standard, r.literary].filter((b) => b.length > 0).length;
    if (filled < 2) err('thin-register', r.id, `register set "${r.meaning}" needs words in at least two bins`);
    if (new Set(words).size !== words.length) err('duplicate-word', r.id, 'a word sits in two bins');
  }

  // Context choices.
  for (const c of content.contexts) {
    if (!c.options.includes(c.answer)) err('answer-not-in-options', c.id, `answer "${c.answer}" is not among the options`);
    if (!c.sentence.includes('___')) err('no-blank', c.id, 'sentence has no ___ blank');
    if (new Set(c.options).size !== c.options.length) err('duplicate-option', c.id, 'options repeat');
    checkText(c.id, c.sentence.replace('___', 'מילה'));
    checkText(c.id, c.explanation);
    c.options.forEach((o) => checkWord(c.id, o));
  }

  // Idioms.
  for (const i of content.idioms) {
    checkWord(i.id, i.idiom);
    checkText(i.id, i.example);
    if (!i.example.includes(i.exampleAnswer)) err('idiom-answer-missing', i.id, `example does not contain "${i.exampleAnswer}"`);
  }

  // Sentences.
  const sentencesPerEntry = new Map<string, number>();
  for (const s of content.sentences) {
    const e = entriesById.get(s.entryId);
    if (!e) {
      err('orphan-sentence', s.id, `unknown entry "${s.entryId}"`);
      continue;
    }
    sentencesPerEntry.set(e.id, (sentencesPerEntry.get(e.id) ?? 0) + 1);
    checkText(s.id, s.text);
    if (!containsWord(s.text, e.headword)) err('sentence-missing-headword', s.id, `"${s.text}" does not contain "${e.headword}"`);
    for (const f of s.fits) {
      if (!e.synonyms.includes(f)) err('fit-not-synonym', s.id, `fit "${f}" is not a synonym of "${e.headword}"`);
    }
    if (s.fits.length === 0) warn('sentence-no-fits', s.id, `no synonym fits as written: "${s.text}"`);
  }
  for (const e of content.entries) {
    const n = sentencesPerEntry.get(e.id) ?? 0;
    if (e.source !== 'custom' && (n < 1 || n > 2)) err('sentence-count', e.id, `"${e.headword}" has ${n} sentences (needs 1-2)`);
  }

  return { errors, warnings, stats: computeStats(content) };
}

function computeStats(content: Content): ContentStats {
  const byCategory: ContentStats['byCategory'] = {};
  for (const c of content.categories) byCategory[c.id] = { booklet: 0, extra: 0, custom: 0, expected: c.expectedCount };
  const byDifficulty: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byPos: Record<string, number> = {};
  const words = new Set<string>();
  let reviewed = 0;
  for (const e of content.entries) {
    const bucket = byCategory[e.categoryId];
    if (bucket) bucket[e.source] += 1;
    byDifficulty[`${e.source}:${e.difficulty}`] = (byDifficulty[`${e.source}:${e.difficulty}`] ?? 0) + 1;
    byDifficulty[`all:${e.difficulty}`] = (byDifficulty[`all:${e.difficulty}`] ?? 0) + 1;
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    byPos[e.pos] = (byPos[e.pos] ?? 0) + 1;
    words.add(normalizeWord(e.headword));
    e.synonyms.forEach((s) => words.add(normalizeWord(s)));
    if (e.reviewed) reviewed += 1;
  }
  const items = [...content.entries, ...content.scales, ...content.registers, ...content.contexts, ...content.idioms];
  const reviewedItems = items.filter((i) => i.reviewed).length;

  return {
    entries: content.entries.length,
    uniqueWords: words.size,
    byCategory,
    byDifficulty,
    bySource,
    byPos,
    reviewed: { reviewed: reviewedItems, unreviewed: items.length - reviewedItems },
    other: {
      intensityScales: content.scales.length,
      registerSets: content.registers.length,
      contextChoices: content.contexts.length,
      idioms: content.idioms.length,
      sentences: content.sentences.length,
      reviewedEntries: reviewed,
    },
    sentencesWithFits: content.sentences.filter((s) => s.fits.length > 0).length,
    largestGroups: naiveGroups(content.entries),
  };
}

/** Union-find over plain word strings. Deliberately ignores hints so the report shows where homographs would merge groups. */
function naiveGroups(entries: Entry[]): { size: number; sample: string[] }[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x)!;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  for (const e of entries) {
    const h = normalizeWord(e.headword);
    for (const s of e.synonyms) parent.set(find(normalizeWord(s)), find(h));
  }
  const groups = new Map<string, string[]>();
  for (const w of parent.keys()) {
    const root = find(w);
    groups.set(root, [...(groups.get(root) ?? []), w]);
  }
  return [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
    .map((g) => ({ size: g.length, sample: g.slice(0, 12) }));
}
