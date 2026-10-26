import { normalizeWord } from '../content/text';
import type { Entry } from '../content/types';
import type { PracticeItem } from '../games/types';
import { dueKeys, type LeitnerState } from './leitner';

/** Guests make up about this share of a level's items (new words + guests). */
export const GUEST_SHARE = 0.3;

/** How many guests to add to `newCount` new words so guests are ~30% of the total. */
export const guestCount = (newCount: number): number => Math.round((newCount * GUEST_SHARE) / (1 - GUEST_SHARE));

/**
 * Guests: due headword-synonym pairs from earlier stations or worlds, weakest first, mixed into a level for review.
 * Skips the level's own entries, entries outside `pool` (e.g. reviewed-only), and keys the content no longer has.
 * At most one guest per entry, so two guests never test the same word.
 */
export function selectGuests(
  leitner: LeitnerState,
  levelEntryIds: readonly string[],
  newCount: number,
  today: string,
  pool: readonly Entry[],
): PracticeItem[] {
  const want = guestCount(newCount);
  const allowed = new Map(pool.map((e) => [e.id, e]));
  const skip = new Set(levelEntryIds);
  const guests: PracticeItem[] = [];
  for (const key of dueKeys(leitner, today)) {
    if (guests.length >= want) break;
    const [entryId = '', word = ''] = key.split('|');
    const entry = allowed.get(entryId);
    if (!entry || skip.has(entry.id)) continue;
    const synonym = entry.synonyms.find((s) => normalizeWord(s) === word);
    if (!synonym) continue;
    skip.add(entry.id);
    guests.push({ key, entry, synonym, isGuest: true });
  }
  return guests;
}
