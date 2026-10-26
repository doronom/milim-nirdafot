import { buildSynonymGraph } from '../engine/graph';
import { buildContent, type ContentSources } from './model';
import type { ContentOverrides, OverrideKind, PairDecisionsAdded, ReviewDecision } from './overrides';
import { normalizeWord } from './text';
import type { AlsoSynonymPair, Entry, NotSynonymPair } from './types';

export const CONTENT_CHANGES_FORMAT = 'word-quest-content-changes';

/**
 * "Export content changes": everything the parent decided about the content, in one file that
 * `npm run apply:content-changes <file>` folds into src/data.
 */
export interface ContentChangesFile {
  format: typeof CONTENT_CHANGES_FORMAT;
  version: 1;
  exportedAt: string;
  /** Field edits per kind, keyed by item id (only the changed fields; `hidden` takes an item out of play). */
  edits: Pick<ContentOverrides, OverrideKind>;
  /** The parent's own words. */
  custom: Entry[];
  /** Content review of unreviewed items and sentences. */
  decisions: Record<string, ReviewDecision>;
  /** Pairs accepted from the in-game "also correct" queue, and rejected ones (fair traps). */
  alsoSynonyms: AlsoSynonymPair[];
  notSynonyms: NotSynonymPair[];
  /** Decided sentence reports: "removed" hides the sentence, "kept" marks it reviewed. */
  sentenceReports: { sentenceId: string; status: 'kept' | 'removed' }[];
  /** Decided disputes on scales, register sets and context choices, for whoever maintains the data. */
  itemDisputes: { itemKey: string; answer: string; status: 'accepted' | 'rejected' }[];
}

export function buildContentChanges(
  ov: ContentOverrides,
  pairs: PairDecisionsAdded,
  sentenceReports: ContentChangesFile['sentenceReports'],
  itemDisputes: ContentChangesFile['itemDisputes'],
  now = new Date(),
): ContentChangesFile {
  return {
    format: CONTENT_CHANGES_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    edits: {
      entries: ov.entries,
      scales: ov.scales,
      registers: ov.registers,
      contexts: ov.contexts,
      idioms: ov.idioms,
      sentences: ov.sentences,
    },
    custom: ov.custom,
    decisions: ov.decisions,
    alsoSynonyms: pairs.alsoSynonyms,
    notSynonyms: pairs.notSynonyms,
    sentenceReports,
    itemDisputes,
  };
}

/** Rejects anything that is not a content-changes export, with a reason. */
export function parseContentChanges(json: unknown): ContentChangesFile {
  const f = json as Partial<ContentChangesFile> | null;
  if (!f || typeof f !== 'object' || f.format !== CONTENT_CHANGES_FORMAT) throw new Error('not a content-changes file');
  if (f.version !== 1) throw new Error(`unsupported content-changes version ${String(f.version)}`);
  return {
    ...f,
    edits: { entries: {}, scales: {}, registers: {}, contexts: {}, idioms: {}, sentences: {}, ...(f.edits ?? {}) },
    custom: f.custom ?? [],
    decisions: f.decisions ?? {},
    alsoSynonyms: f.alsoSynonyms ?? [],
    notSynonyms: f.notSynonyms ?? [],
    sentenceReports: f.sentenceReports ?? [],
    itemDisputes: f.itemDisputes ?? [],
  } as ContentChangesFile;
}

type Item = { id: string; hidden?: boolean; reviewed?: boolean } & Record<string, unknown>;

/** Applies field edits and review decisions to one list. `reviewable` lists get `reviewed: true` on approval. */
function merge<T extends { id: string }>(
  list: readonly T[],
  edits: Record<string, Record<string, unknown>>,
  decisions: Record<string, ReviewDecision>,
  reviewable: boolean,
  skip: readonly string[] = [],
): T[] {
  return list.map((orig) => {
    const item = { ...orig } as unknown as Item;
    for (const [k, v] of Object.entries(edits[item.id] ?? {})) if (!skip.includes(k)) item[k] = v;
    if (decisions[item.id] === 'approved' && reviewable) item.reviewed = true;
    if (decisions[item.id] === 'rejected') item.hidden = true;
    if (item.hidden === false) delete item.hidden;
    return item as unknown as T;
  });
}

const pairId = (p: AlsoSynonymPair) => [p.a, p.b].sort().join('~');
const trapId = (p: NotSynonymPair) => `${p.targetId}|${normalizeWord(p.distractor)}`;

/**
 * The data files with a content-changes export folded in (a new object; the inputs are not touched). Booklet hint
 * edits go to senses.json, like every other booklet hint, so a booklet entry keeps its printed fields otherwise.
 */
export function applyContentChanges(src: ContentSources, ch: ContentChangesFile): ContentSources {
  const s = structuredClone(src);
  const edits = ch.edits as unknown as Record<OverrideKind, Record<string, Record<string, unknown>>>;
  const { decisions } = ch;

  const cleared = new Set<string>();
  const set: Record<string, string> = {};
  for (const e of s.booklet.entries) {
    const edit = edits.entries[e.id];
    if (!edit || !('hint' in edit)) continue;
    if (typeof edit.hint === 'string' && edit.hint !== '') set[e.id] = edit.hint;
    else cleared.add(e.id);
  }
  const hints = { ...Object.fromEntries(Object.entries(s.senses.hints).filter(([id]) => !cleared.has(id))), ...set };
  const bookletEntries = merge(s.booklet.entries, edits.entries, decisions, false, ['hint']).map((e) => {
    const edit = edits.entries[e.id];
    return edit && 'hint' in edit && !(typeof edit.hint === 'string' && edit.hint !== '') ? { ...e, hint: null } : e;
  });

  const sentenceStatus = new Map(ch.sentenceReports.map((r) => [r.sentenceId, r.status]));
  const sentences = merge(s.sentences.sentences, edits.sentences, decisions, true).map((x) => {
    const status = sentenceStatus.get(x.id);
    if (status === 'removed') return { ...x, hidden: true };
    if (status === 'kept') return { ...x, reviewed: true };
    return x;
  });

  const custom = merge(s.custom ?? [], edits.entries, decisions, true);
  for (const e of ch.custom) {
    const i = custom.findIndex((c) => c.id === e.id);
    const word = { ...e, ...(edits.entries[e.id] ?? {}) } as Entry;
    if (word.hidden === false) delete word.hidden;
    if (i >= 0) custom[i] = word;
    else custom.push(word);
  }

  // Exports written before stable node ids name nodes by label ("מתוח#tense"); map them to today's ids.
  const graph = buildSynonymGraph(buildContent(src));
  const incoming = ch.alsoSynonyms.map((p) => ({ ...p, a: graph.migrate(p.a), b: graph.migrate(p.b) }));
  const knownPairs = new Set(s.alsoSynonyms.pairs.map(pairId));
  const knownTraps = new Set(s.notSynonyms.pairs.map(trapId));
  return {
    ...s,
    booklet: { ...s.booklet, entries: bookletEntries },
    senses: { ...s.senses, hints },
    extra: {
      ...s.extra,
      newEntries: merge(s.extra.newEntries, edits.entries, decisions, true),
      intensityScales: merge(s.extra.intensityScales, edits.scales, decisions, true),
      registerSets: merge(s.extra.registerSets, edits.registers, decisions, true),
      contextChoices: merge(s.extra.contextChoices, edits.contexts, decisions, true),
      idioms: merge(s.extra.idioms, edits.idioms, decisions, true),
    },
    sentences: { ...s.sentences, sentences },
    custom,
    alsoSynonyms: {
      ...s.alsoSynonyms,
      pairs: [...s.alsoSynonyms.pairs, ...incoming.filter((p) => !knownPairs.has(pairId(p)))],
    },
    notSynonyms: {
      ...s.notSynonyms,
      pairs: [...s.notSynonyms.pairs, ...ch.notSynonyms.filter((p) => !knownTraps.has(trapId(p)))],
    },
  };
}
