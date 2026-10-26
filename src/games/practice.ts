import { normalizeWord } from '../content/text';
import type { Entry } from '../content/types';
import type { LeitnerState } from '../engine/leitner';
import type { PracticeItem } from './types';

export const pairKey = (entry: Entry, synonym: string): string => `${entry.id}|${normalizeWord(synonym)}`;

/** The synonym of an entry the child knows least (lowest box, never seen first), for this session's questions. */
export function practiceItemFor(entry: Entry, leitner: LeitnerState): PracticeItem {
  const ranked = entry.synonyms
    .map((synonym, order) => ({ synonym, order, card: leitner[pairKey(entry, synonym)] }))
    .sort((a, b) => (a.card?.box ?? 0) - (b.card?.box ?? 0) || a.order - b.order);
  const synonym = ranked[0]!.synonym;
  return { key: pairKey(entry, synonym), entry, synonym };
}

/**
 * Greedy grouping so no word on a board is directly linked to a word of another pair on the same board, which would
 * make two matches look right. Items that conflict with every open board start a new one.
 */
export function conflictFreeGroups(
  items: PracticeItem[],
  size: number,
  linked: (a: string, b: string) => boolean,
): PracticeItem[][] {
  const groups: PracticeItem[][] = [];
  const clash = (a: PracticeItem, b: PracticeItem) => {
    const wa = [a.entry.headword, a.synonym];
    const wb = [b.entry.headword, b.synonym];
    return (
      a.entry.id === b.entry.id || wa.some((x) => wb.some((y) => normalizeWord(x) === normalizeWord(y) || linked(x, y)))
    );
  };
  for (const item of items) {
    const open = groups.find((g) => g.length < size && g.every((other) => !clash(item, other)));
    if (open) open.push(item);
    else groups.push([item]);
  }
  return groups;
}
