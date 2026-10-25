import type { Content, Entry } from './types';
import { POS_VALUES } from './types';
import { buildSynonymGraph, type SynonymGraph } from '../engine/graph';
import { containsWord, HAS_NIQQUD, normalizeWord } from './text';

export { containsWord, normalizeWord, stripNiqqud } from './text';

/** Above this size a connected synonym group gets a warning: it often means a homograph merged two meanings. */
export const MAX_GROUP_WORDS = 8;

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
  /** Connected groups in the synonym graph, and the largest ones (node ids; "#" marks a split sense). */
  groups: number;
  largestGroups: { size: number; words: string[] }[];
}

/** Words: Hebrew letters, single inner spaces, maqaf, and niqqud (flagged separately). */
// Niqqud are combining marks; mixing them with letters in one class is intended here.
/* eslint-disable no-misleading-character-class */
const WORD_OK =
  /^[\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7]+(?:[ \u05BE][\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7]+)*\u05BE?$/;
/** Free text (sentences, explanations): words plus everyday punctuation. */
const TEXT_OK = /^[\u05D0-\u05EA\u0591-\u05C7 ,.!?:;"'\-\u2013\u2026=()0-9]+$/;
/* eslint-enable no-misleading-character-class */

export function validateContent(content: Content): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (code: string, ref: string, message: string) => errors.push({ code, ref, message });
  const warn = (code: string, ref: string, message: string) => warnings.push({ code, ref, message });

  // Duplicate ids across every item type.
  const allIds = [
    ...content.categories.map((c) => `category:${c.id}`),
    ...[
      ...content.entries,
      ...content.scales,
      ...content.registers,
      ...content.contexts,
      ...content.idioms,
      ...content.sentences,
    ].map((x) => x.id),
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
    if (![1, 2, 3].includes(e.difficulty))
      err('bad-difficulty', e.id, `difficulty must be 1-3, got ${String(e.difficulty)}`);
    if (!POS_VALUES.includes(e.pos)) err('bad-pos', e.id, `unknown part of speech "${String(e.pos)}"`);
    if (e.synonyms.length === 0) err('empty-synonyms', e.id, `"${e.headword}" has no synonyms`);
    checkWord(e.id, e.headword);
    e.synonyms.forEach((s) => checkWord(e.id, s));
    if (e.hint !== null) checkText(e.id, e.hint);
    const norm = e.synonyms.map(normalizeWord);
    if (new Set(norm).size !== norm.length) err('duplicate-synonym', e.id, `"${e.headword}" lists a synonym twice`);
    if (norm.includes(normalizeWord(e.headword)))
      err('self-synonym', e.id, `"${e.headword}" lists itself as a synonym`);
    if (e.hint !== null && [...norm, normalizeWord(e.headword)].includes(normalizeWord(e.hint))) {
      err('hint-gives-answer', e.id, `hint "${e.hint}" of "${e.headword}" equals the headword or one of its synonyms`);
    }
    const key = normalizeWord(e.headword);
    headwordKeys.set(key, [...(headwordKeys.get(key) ?? []), e]);
  }
  for (const [word, list] of headwordKeys) {
    if (list.length < 2) continue;
    const hints = list.map((e) => e.hint ?? '');
    if (hints.includes('') || new Set(hints).size !== hints.length) {
      err(
        'homograph-without-hint',
        list.map((e) => e.id).join(','),
        `headword "${word}" appears ${list.length} times without distinct hints`,
      );
    }
  }

  // senses.json: every split must point at items that really contain the word, each item in one sense only.
  const itemWords = new Map<string, string[]>([
    ...content.entries.map((e): [string, string[]] => [e.id, [e.headword, ...e.synonyms]]),
    ...content.registers.map((r): [string, string[]] => [r.id, [...r.everyday, ...r.standard, ...r.literary]]),
  ]);
  const splitWords = new Set<string>();
  for (const split of content.senseSplits) {
    const word = normalizeWord(split.word);
    if (splitWords.has(word)) err('sense-duplicate-word', split.word, 'word is split twice');
    splitWords.add(word);
    if (split.senses.length < 2) err('sense-single', split.word, 'a split needs at least two senses');
    const keys = new Set<string>();
    const items = new Set<string>();
    for (const sense of split.senses) {
      if (keys.has(sense.key)) err('sense-duplicate-key', split.word, `sense key "${sense.key}" repeats`);
      keys.add(sense.key);
      if (sense.items.length === 0) err('sense-empty', split.word, `sense "${sense.key}" lists no items`);
      for (const id of sense.items) {
        const words = itemWords.get(id);
        if (!words) err('sense-unknown-item', split.word, `sense "${sense.key}" lists unknown item "${id}"`);
        else if (!words.some((w) => normalizeWord(w) === word))
          err('sense-word-missing', split.word, `item "${id}" does not contain "${split.word}"`);
        if (items.has(id)) err('sense-item-twice', split.word, `item "${id}" is in two senses`);
        items.add(id);
      }
    }
  }

  // Synonym graph. A group above the threshold is a signal (often a homograph merging two meanings), not an error:
  // warn unless large-groups.json approves it at its current size.
  const graph = buildSynonymGraph(content);
  for (const { a, b } of content.alsoSynonyms) {
    for (const id of [a, b])
      if (!graph.nodes.has(id)) err('also-synonym-unknown-node', id, `also-synonyms.json names unknown node "${id}"`);
  }
  const allSpellings = new Set([...graph.nodes.values()].map((n) => n.key));
  const traps = new Set<string>();
  for (const t of content.notSynonyms) {
    if (!entriesById.has(t.targetId))
      err('not-synonym-unknown-target', t.targetId, `not-synonyms.json names unknown entry "${t.targetId}"`);
    if (!allSpellings.has(normalizeWord(t.distractor)))
      err('not-synonym-unknown-word', t.targetId, `"${t.distractor}" is not a word in the content`);
    traps.add(`${t.targetId}|${normalizeWord(t.distractor)}`);
  }
  for (const { a, b } of content.alsoSynonyms) {
    const node = graph.nodes.get(a);
    for (const id of node?.entryIds ?? []) {
      if (traps.has(`${id}|${normalizeWord(b.split('#')[0]!)}`))
        err('pair-in-both-files', `${a}~${b}`, 'pair is both a synonym and a confirmed trap');
    }
  }
  for (const approval of content.approvedLargeGroups) {
    if (!graph.nodes.has(approval.anchor))
      err('large-group-unknown-anchor', approval.anchor, `large-groups.json names unknown node "${approval.anchor}"`);
  }
  for (const group of graph.groups) {
    if (group.length <= MAX_GROUP_WORDS) continue;
    const approval = content.approvedLargeGroups.find((a) => group.includes(a.anchor));
    if (!approval) {
      warn(
        'group-large',
        group[0]!,
        `synonym group has ${group.length} words (threshold ${MAX_GROUP_WORDS}): ${group.join(', ')}`,
      );
    } else if (group.length > approval.maxSize) {
      warn(
        'group-grew',
        approval.anchor,
        `approved group grew to ${group.length} words (approved ${approval.maxSize}): ${group.join(', ')}`,
      );
    }
  }
  const sameMeaning = new Set(content.sameMeaning.map(normalizeWord));
  for (const node of graph.nodes.values()) {
    if (node.pos.length > 1 && !sameMeaning.has(node.key)) {
      warn(
        'cross-pos-word',
        node.id,
        `"${node.word}" is shared across parts of speech (${node.pos.join('/')} in ${node.entryIds.join(',')}); split it in senses.json or list it under sameMeaning`,
      );
    }
  }

  // Booklet category counts.
  for (const c of content.categories) {
    if (c.expectedCount === undefined) continue;
    const n = content.entries.filter((e) => e.categoryId === c.id && e.source === 'booklet').length;
    if (n !== c.expectedCount) err('category-count', c.id, `expected ${c.expectedCount} booklet entries, found ${n}`);
  }

  // Intensity scales.
  for (const s of content.scales) {
    if (s.weakToStrong.length < 3)
      err('short-scale', s.id, `scale "${s.theme}" has ${s.weakToStrong.length} words (needs 3+)`);
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
    if (!c.options.includes(c.answer))
      err('answer-not-in-options', c.id, `answer "${c.answer}" is not among the options`);
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
    if (!i.example.includes(i.exampleAnswer))
      err('idiom-answer-missing', i.id, `example does not contain "${i.exampleAnswer}"`);
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
    if (!containsWord(s.text, e.headword))
      err('sentence-missing-headword', s.id, `"${s.text}" does not contain "${e.headword}"`);
    for (const f of s.fits) {
      if (!e.synonyms.includes(f)) err('fit-not-synonym', s.id, `fit "${f}" is not a synonym of "${e.headword}"`);
    }
    if (s.fits.length === 0) warn('sentence-no-fits', s.id, `no synonym fits as written: "${s.text}"`);
  }
  for (const e of content.entries) {
    const n = sentencesPerEntry.get(e.id) ?? 0;
    if (e.source !== 'custom' && (n < 1 || n > 2))
      err('sentence-count', e.id, `"${e.headword}" has ${n} sentences (needs 1-2)`);
  }

  return { errors, warnings, stats: computeStats(content, graph) };
}

function computeStats(content: Content, graph: SynonymGraph): ContentStats {
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
    groups: graph.groups.length,
    largestGroups: graph.groups.slice(0, 10).map((g) => ({ size: g.length, words: g })),
  };
}
