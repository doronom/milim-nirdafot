import { sourceId, type ItemResolver } from '../games/items';
import type { LevelItem } from '../games/types';
import { dueKeys, type LeitnerState } from './leitner';

/** Guests make up about this share of a level's items (new items + guests). */
export const GUEST_SHARE = 0.3;

/** How many guests to add to `newCount` new items so guests are ~30% of the total. */
export const guestCount = (newCount: number): number => Math.round((newCount * GUEST_SHARE) / (1 - GUEST_SHARE));

/**
 * Guests: due items from earlier stations or worlds (pairs, scales, register sets, contexts), weakest first, mixed
 * into a level for review. Skips the level's own material, items the resolver cannot find (e.g. outside the
 * reviewed-only pool), and takes at most one pair per entry so two guests never test the same word.
 */
export function selectGuests(
  leitner: LeitnerState,
  levelSourceIds: readonly string[],
  newCount: number,
  today: string,
  resolver: ItemResolver,
): LevelItem[] {
  const want = guestCount(newCount);
  const skip = new Set(levelSourceIds);
  const guests: LevelItem[] = [];
  for (const key of dueKeys(leitner, today)) {
    if (guests.length >= want) break;
    const item = resolver.byKey(key);
    if (!item || skip.has(sourceId(item))) continue;
    skip.add(sourceId(item));
    guests.push({ ...item, isGuest: true });
  }
  return guests;
}
