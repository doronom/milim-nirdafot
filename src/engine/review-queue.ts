import type { AlsoSynonymPair, Entry, NotSynonymPair } from '../content/types';
import type { KeyValueStore } from '../storage/kv';
import { pairKey } from './distractors';
import { headwordAlias, type SynonymGraph } from './graph';

export type ReportStatus = 'pending' | 'accepted' | 'rejected';

/** A wrong option the child said is also correct, waiting for (or past) parent review. */
export interface AlsoCorrectReport {
  /** pairKey(targetId, word) */
  id: string;
  targetId: string;
  targetWord: string;
  word: string;
  /** Graph node of the offered word, so an accepted pair links the right sense. */
  nodeId: string;
  gameId: string;
  reportedAt: string;
  /** How many times it was reported; repeated reports are a useful signal for the reviewer. */
  count: number;
  status: ReportStatus;
  decidedAt?: string;
}

export interface ReportInput {
  target: Entry;
  word: string;
  nodeId: string;
  gameId: string;
}

const KEY = 'review:also-correct';

export async function listReports(store: KeyValueStore): Promise<AlsoCorrectReport[]> {
  return (await store.get<AlsoCorrectReport[]>(KEY)) ?? [];
}

/** Queues a pair for review, or bumps its count when already known. A decided pair keeps its decision. */
export async function reportAlsoCorrect(
  store: KeyValueStore,
  input: ReportInput,
  now = new Date(),
): Promise<AlsoCorrectReport> {
  const reports = await listReports(store);
  const id = pairKey(input.target.id, input.word);
  const existing = reports.find((r) => r.id === id);
  let report: AlsoCorrectReport;
  if (existing) {
    report = { ...existing, count: existing.count + 1 };
  } else {
    report = {
      id,
      targetId: input.target.id,
      targetWord: input.target.headword,
      word: input.word,
      nodeId: input.nodeId,
      gameId: input.gameId,
      reportedAt: now.toISOString(),
      count: 1,
      status: 'pending',
    };
  }
  await store.set(KEY, [...reports.filter((r) => r.id !== id), report]);
  return report;
}

export async function decideReport(
  store: KeyValueStore,
  id: string,
  status: Exclude<ReportStatus, 'pending'>,
  now = new Date(),
): Promise<void> {
  const reports = await listReports(store);
  if (!reports.some((r) => r.id === id)) throw new Error(`unknown report ${id}`);
  await store.set(
    KEY,
    reports.map((r) => (r.id === id ? { ...r, status, decidedAt: now.toISOString() } : r)),
  );
}

/** Pair keys the distractor picker must not offer until reviewed. */
export const pendingKeys = (reports: readonly AlsoCorrectReport[]): Set<string> =>
  new Set(reports.filter((r) => r.status === 'pending').map((r) => r.id));

/**
 * Decided reports in the shape of also-synonyms.json and not-synonyms.json, ready to export and commit.
 * Accepted reports link the target's headword (by its stable alias, "<entryId>.0") with the offered word's node.
 */
export function exportDecisions(
  reports: readonly AlsoCorrectReport[],
  graph: SynonymGraph,
  entries: readonly Entry[],
): { alsoSynonyms: AlsoSynonymPair[]; notSynonyms: NotSynonymPair[] } {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const alsoSynonyms: AlsoSynonymPair[] = [];
  const notSynonyms: NotSynonymPair[] = [];
  for (const r of reports) {
    const target = byId.get(r.targetId);
    if (!target) continue;
    if (r.status === 'accepted')
      alsoSynonyms.push({ a: headwordAlias(target.id), b: graph.migrate(r.nodeId), note: `reported in ${r.gameId}` });
    if (r.status === 'rejected')
      notSynonyms.push({ targetId: r.targetId, distractor: r.word, note: `reported in ${r.gameId}` });
  }
  return { alsoSynonyms, notSynonyms };
}

/** "Also correct" on a scale, register set or context choice: the child's answer, for the parent to judge. */
export interface ItemDispute {
  itemKey: string;
  answer: string;
  gameId: string;
  reportedAt: string;
  count: number;
  status: ReportStatus;
}

const DISPUTES = 'review:item-disputes';

export async function listItemDisputes(store: KeyValueStore): Promise<ItemDispute[]> {
  return (await store.get<ItemDispute[]>(DISPUTES)) ?? [];
}

export async function reportItemDispute(
  store: KeyValueStore,
  input: { itemKey: string; answer: string; gameId: string },
  now = new Date(),
): Promise<ItemDispute> {
  const list = await listItemDisputes(store);
  const existing = list.find((d) => d.itemKey === input.itemKey && d.answer === input.answer);
  const dispute: ItemDispute = existing
    ? { ...existing, count: existing.count + 1 }
    : { ...input, reportedAt: now.toISOString(), count: 1, status: 'pending' };
  await store.set(DISPUTES, [...list.filter((d) => d !== existing), dispute]);
  return dispute;
}

export async function decideItemDispute(
  store: KeyValueStore,
  itemKey: string,
  answer: string,
  status: Exclude<ReportStatus, 'pending'>,
): Promise<void> {
  const list = await listItemDisputes(store);
  await store.set(
    DISPUTES,
    list.map((d) => (d.itemKey === itemKey && d.answer === answer ? { ...d, status } : d)),
  );
}
