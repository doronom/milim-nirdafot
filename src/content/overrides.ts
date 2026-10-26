import { normalizeWord } from './text';
import type {
  AlsoSynonymPair,
  Content,
  ContextChoice,
  Entry,
  Idiom,
  IntensityScale,
  NotSynonymPair,
  RegisterSet,
  Sentence,
} from './types';

/** Fields a parent may change, per kind. `hidden` takes an item out of play without deleting it. */
export type EntryEdit = Partial<Pick<Entry, 'headword' | 'hint' | 'synonyms' | 'difficulty' | 'pos'>> & {
  hidden?: boolean;
};
export type ScaleEdit = Partial<Pick<IntensityScale, 'theme' | 'weakToStrong'>> & { hidden?: boolean };
export type RegisterEdit = Partial<Pick<RegisterSet, 'meaning' | 'everyday' | 'standard' | 'literary'>> & {
  hidden?: boolean;
};
export type ContextEdit = Partial<Pick<ContextChoice, 'sentence' | 'options' | 'answer' | 'explanation'>> & {
  hidden?: boolean;
};
export type IdiomEdit = Partial<Pick<Idiom, 'idiom' | 'meaning' | 'example' | 'exampleAnswer'>> & { hidden?: boolean };
export type SentenceEdit = Partial<Pick<Sentence, 'text' | 'fits'>> & { hidden?: boolean };

export type ReviewDecision = 'approved' | 'rejected';

export const OVERRIDE_KINDS = ['entries', 'scales', 'registers', 'contexts', 'idioms', 'sentences'] as const;
export type OverrideKind = (typeof OVERRIDE_KINDS)[number];

/**
 * The parent's changes, layered over the bundled data at runtime (stored in IndexedDB, keyed by item id). The bundled
 * files are never modified in the app; `npm run apply:content-changes` folds an export of this into them.
 */
export interface ContentOverrides {
  version: 1;
  entries: Record<string, EntryEdit>;
  scales: Record<string, ScaleEdit>;
  registers: Record<string, RegisterEdit>;
  contexts: Record<string, ContextEdit>;
  idioms: Record<string, IdiomEdit>;
  sentences: Record<string, SentenceEdit>;
  /** The parent's own words ("המילים שלי"). */
  custom: Entry[];
  /** Content review of unreviewed items and sentences, by id. Approved counts as reviewed; rejected leaves play. */
  decisions: Record<string, ReviewDecision>;
}

export const emptyOverrides = (): ContentOverrides => ({
  version: 1,
  entries: {},
  scales: {},
  registers: {},
  contexts: {},
  idioms: {},
  sentences: {},
  custom: [],
  decisions: {},
});

/** Pairs decided from the in-game "also correct" queue, added to the bundled decision files. */
export interface PairDecisionsAdded {
  alsoSynonyms: AlsoSynonymPair[];
  notSynonyms: NotSynonymPair[];
}

function applyList<T extends { id: string; reviewed: boolean; hidden?: boolean }, E extends { hidden?: boolean }>(
  items: readonly T[],
  edits: Record<string, E>,
  decisions: Record<string, ReviewDecision>,
): T[] {
  return items.map((item) => {
    const edit = edits[item.id];
    const decision = decisions[item.id];
    const next = { ...item, ...(edit ?? {}) } as T;
    if (decision === 'approved') next.reviewed = true;
    if (decision === 'rejected') next.hidden = true;
    return next;
  });
}

/**
 * The content with every override applied, hidden items still included (they stay in validation, so hiding a booklet
 * entry never breaks a booklet count). Use `playable` to drop them for play.
 */
export function applyOverrides(
  base: Content,
  ov: ContentOverrides,
  added: PairDecisionsAdded = { alsoSynonyms: [], notSynonyms: [] },
): Content {
  const custom = ov.custom.map((e) => ({ ...e, ...(ov.entries[e.id] ?? {}) }));
  const categories =
    custom.length > 0 && !base.categories.some((c) => c.id === 'custom')
      ? [...base.categories, { id: 'custom', order: base.categories.length + 1, title: 'המילים שלי' }]
      : base.categories;
  return {
    ...base,
    categories,
    entries: [...applyList(base.entries, ov.entries, ov.decisions), ...custom],
    scales: applyList(base.scales, ov.scales, ov.decisions),
    registers: applyList(base.registers, ov.registers, ov.decisions),
    contexts: applyList(base.contexts, ov.contexts, ov.decisions),
    idioms: applyList(base.idioms, ov.idioms, ov.decisions),
    sentences: applyList(base.sentences, ov.sentences, ov.decisions),
    alsoSynonyms: [...base.alsoSynonyms, ...added.alsoSynonyms],
    notSynonyms: [...base.notSynonyms, ...added.notSynonyms],
  };
}

/** The content as played: hidden and rejected items left out, with sentences of hidden entries. */
export function playable(c: Content): Content {
  const entries = c.entries.filter((e) => !e.hidden);
  const ids = new Set(entries.map((e) => e.id));
  return {
    ...c,
    entries,
    scales: c.scales.filter((s) => !s.hidden),
    registers: c.registers.filter((r) => !r.hidden),
    contexts: c.contexts.filter((x) => !x.hidden),
    idioms: c.idioms.filter((i) => !i.hidden),
    sentences: c.sentences.filter((s) => !s.hidden && ids.has(s.entryId)),
  };
}

/** Whether an item carries any parent change (for the "edited" badge and "revert to original"). */
export const isEdited = (ov: ContentOverrides, kind: OverrideKind, id: string): boolean => id in ov[kind];

export function revert(ov: ContentOverrides, kind: OverrideKind, id: string): ContentOverrides {
  const { [id]: _removed, ...rest } = ov[kind] as Record<string, unknown>;
  void _removed;
  return { ...ov, [kind]: rest };
}

/** Pair keys (Leitner) of an entry's synonyms. */
const pairKeys = (e: Pick<Entry, 'id' | 'synonyms'>) => new Set(e.synonyms.map((s) => `${e.id}|${normalizeWord(s)}`));

/**
 * Pair keys an edit removes and adds, comparing an entry before and after: removed pairs drop their Leitner boxes,
 * added pairs start in box 1 (when the entry is already being learned).
 */
export function pairChanges(
  before: Pick<Entry, 'id' | 'synonyms'> | undefined,
  after: Pick<Entry, 'id' | 'synonyms'> | undefined,
): { removed: string[]; added: string[] } {
  const a = before ? pairKeys(before) : new Set<string>();
  const b = after ? pairKeys(after) : new Set<string>();
  return { removed: [...a].filter((k) => !b.has(k)), added: [...b].filter((k) => !a.has(k)) };
}
