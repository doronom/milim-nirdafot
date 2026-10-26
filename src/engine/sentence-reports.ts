import type { Sentence } from '../content/types';
import type { KeyValueStore } from '../storage/kv';

export type SentenceReportStatus = 'pending' | 'kept' | 'removed';

/** An example sentence the child reported from swapWord ("דווח על משפט"). */
export interface SentenceReport {
  sentenceId: string;
  entryId: string;
  gameId: string;
  reportedAt: string;
  count: number;
  status: SentenceReportStatus;
  decidedAt?: string;
}

const KEY = 'review:sentence-reports';

export async function listSentenceReports(store: KeyValueStore): Promise<SentenceReport[]> {
  return (await store.get<SentenceReport[]>(KEY)) ?? [];
}

/** Queues a sentence for review, or bumps its count. A decided report keeps its decision. */
export async function reportSentence(
  store: KeyValueStore,
  sentence: Sentence,
  gameId: string,
  now = new Date(),
): Promise<SentenceReport> {
  const reports = await listSentenceReports(store);
  const existing = reports.find((r) => r.sentenceId === sentence.id);
  const report: SentenceReport = existing
    ? { ...existing, count: existing.count + 1 }
    : {
        sentenceId: sentence.id,
        entryId: sentence.entryId,
        gameId,
        reportedAt: now.toISOString(),
        count: 1,
        status: 'pending',
      };
  await store.set(KEY, [...reports.filter((r) => r.sentenceId !== sentence.id), report]);
  return report;
}

export async function decideSentenceReport(
  store: KeyValueStore,
  sentenceId: string,
  status: Exclude<SentenceReportStatus, 'pending'>,
  now = new Date(),
): Promise<void> {
  const reports = await listSentenceReports(store);
  if (!reports.some((r) => r.sentenceId === sentenceId)) throw new Error(`unknown sentence report ${sentenceId}`);
  await store.set(
    KEY,
    reports.map((r) => (r.sentenceId === sentenceId ? { ...r, status, decidedAt: now.toISOString() } : r)),
  );
}

/**
 * Sentences out of play: reported and pending, or removed by the parent. An approved sentence (reviewed) is never
 * taken out by a report alone; only an explicit "removed" decision does that.
 */
export function blockedSentenceIds(reports: readonly SentenceReport[], sentences: readonly Sentence[]): Set<string> {
  const approved = new Set(sentences.filter((s) => s.reviewed).map((s) => s.id));
  return new Set(
    reports
      .filter((r) => r.status === 'removed' || (r.status === 'pending' && !approved.has(r.sentenceId)))
      .map((r) => r.sentenceId),
  );
}
