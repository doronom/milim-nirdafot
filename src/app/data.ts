import { content, onlyReviewed } from '../content';
import { createDisplayWord, createItemLabel } from '../content/display';
import type { Entry, Sentence } from '../content/types';
import { buildSynonymGraph } from '../engine/graph';
import type { Layout, LevelDef } from '../engine/layout';
import { buildSynonymLinks } from '../engine/links';
import layoutJson from '../generated/layout.json';

/** Static game data for the UI: content plus the build-time level layout. */
export const layout = layoutJson as Layout;
export { content };
export const displayWord = createDisplayWord(content);
export const itemLabel = createItemLabel(content);

/** Built from all content, so unreviewed synonyms still keep wrong options out (see distractors.ts). */
export const graph = buildSynonymGraph(content);
export const links = buildSynonymLinks(content);
const reviewedIds = new Set(onlyReviewed(content).entries.map((e) => e.id));
const worldOneEntries = content.entries.filter((e) => e.source === 'booklet' && e.difficulty === 1);

/**
 * Entries distractors may be drawn from. World 1 sticks to the everyday booklet words it teaches, so a wrong option
 * is never a rare word the child has not met; the reviewed-only setting narrows the pool further.
 */
export function entryPool(reviewedOnly: boolean, worldId: number): readonly Entry[] {
  const base = worldId === 1 ? worldOneEntries : content.entries;
  return reviewedOnly ? base.filter((e) => reviewedIds.has(e.id)) : base;
}

/** Entries guests may come from: any earlier word, narrowed by the reviewed-only setting. */
export const guestPool = (reviewedOnly: boolean): readonly Entry[] =>
  reviewedOnly ? content.entries.filter((e) => reviewedIds.has(e.id)) : content.entries;

/** The example sentence for a learn card, respecting the reviewed-only setting. */
export function sentenceFor(entry: Entry, reviewedOnly: boolean): Sentence | undefined {
  return content.sentences.find((s) => s.entryId === entry.id && (!reviewedOnly || s.reviewed));
}

/** A sticker is named after its level's first item; review and boss levels have none. */
export const stickerLabel = (level: LevelDef): string =>
  level.itemIds[0] ? (itemLabel(level.itemIds[0]) ?? 'חזרה') : 'חזרה';
