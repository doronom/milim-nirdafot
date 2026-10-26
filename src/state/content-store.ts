import { bundledContent } from '../app/data';
import { emptyOverrides, type ContentOverrides, type PairDecisionsAdded } from '../content/overrides';
import { buildSynonymGraph } from '../engine/graph';
import { exportDecisions, listReports } from '../engine/review-queue';
import type { KeyValueStore } from '../storage/kv';

export const OVERRIDES_KEY = 'content:overrides';
const baseGraph = buildSynonymGraph(bundledContent);

/** Pairs the parent decided in the "also correct" queue, as additions to also-synonyms and not-synonyms. */
export async function decidedPairs(store: KeyValueStore): Promise<PairDecisionsAdded> {
  return exportDecisions(await listReports(store), baseGraph, bundledContent.entries);
}

export interface SavedContent {
  overrides: ContentOverrides;
  added: PairDecisionsAdded;
}

/** The parent's overrides and pair decisions; a broken store falls back to the bundled content. */
export async function loadSavedContent(store: KeyValueStore): Promise<SavedContent> {
  const [saved, added] = await Promise.all([
    store.get<ContentOverrides>(OVERRIDES_KEY).catch(() => undefined),
    decidedPairs(store).catch(() => ({ alsoSynonyms: [], notSynonyms: [] })),
  ]);
  return { overrides: { ...emptyOverrides(), ...(saved ?? {}) }, added };
}
