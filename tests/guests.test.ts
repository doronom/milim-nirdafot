import { describe, expect, it } from 'vitest';
import { content, onlyReviewed } from '../src/content';
import { guestCount, selectGuests } from '../src/engine/guests';
import { buildLayout } from '../src/engine/layout';
import type { LeitnerCard, LeitnerState } from '../src/engine/leitner';
import { createResolver, sourceId } from '../src/games/items';
import { pairKey } from '../src/games/practice';
import { sessionFor } from './helpers';

const today = '2026-10-25';
const card = (box: LeitnerCard['box'], due: string, lapses = 0): LeitnerCard => ({
  box,
  due,
  seen: 2,
  lapses,
  lastSeen: '2026-10-20',
});
const entry = (id: string) => content.entries.find((e) => e.id === id)!;
const key = (id: string, i = 0) => pairKey(entry(id), entry(id).synonyms[i]!);
const layout = buildLayout(content);
const all = createResolver(content);

describe('guests', () => {
  it('adds about 30% guests on top of the new items', () => {
    expect([6, 7, 8].map(guestCount)).toEqual([3, 3, 3]);
    expect(guestCount(0)).toBe(0);
    expect(guestCount(14)).toBe(6);
  });

  it('takes due items weakest first, one per entry, never the level own entries or items not yet due', () => {
    const state: LeitnerState = {
      [key('b031')]: card(3, '2026-10-20'),
      [key('b058')]: card(1, '2026-10-25', 2),
      [key('b058', 1)]: card(1, '2026-10-24'),
      [key('b060')]: card(2, '2026-10-30'),
      [key('b001')]: card(1, '2026-10-22'),
      [key('b035')]: card(2, '2026-10-21'),
    };
    const guests = selectGuests(state, ['b001'], 7, today, all);
    expect(guests.map((g) => g.key)).toEqual([key('b058', 1), key('b035'), key('b031')]);
    expect(guests.every((g) => g.isGuest)).toBe(true);
  });

  it('includes scales, register sets and context choices', () => {
    const state: LeitnerState = {
      scale03: card(1, '2026-10-20'),
      reg05: card(1, '2026-10-21'),
      ctx02: card(2, '2026-10-22'),
    };
    expect(selectGuests(state, [], 7, today, all).map((g) => [g.kind, g.key])).toEqual([
      ['scale', 'scale03'],
      ['register', 'reg05'],
      ['context', 'ctx02'],
    ]);
  });

  it('respects the pool (reviewed-only drops guests from unreviewed entries)', () => {
    const state: LeitnerState = { [key('e001')]: card(1, '2026-10-20'), [key('b031')]: card(1, '2026-10-21') };
    expect(selectGuests(state, [], 7, today, all).map(sourceId)).toEqual(['e001', 'b031']);
    expect(
      selectGuests(state, [], 7, today, createResolver(content, onlyReviewed(content).entries)).map(sourceId),
    ).toEqual(['b031']);
  });

  it('mixes guests into a level session, but not into its learn cards', () => {
    const level = layout.worlds[0]!.stations[1]!.levels[0]!;
    const state: LeitnerState = {
      [key('b001')]: card(1, '2026-10-20'),
      [key('b004')]: card(2, '2026-10-21'),
      [key('b009')]: card(1, '2026-10-22'),
    };
    const session = sessionFor(level, state);
    expect(session.learn.map(sourceId)).toEqual(level.itemIds);
    expect(
      session.items
        .filter((i) => i.isGuest)
        .map(sourceId)
        .sort(),
    ).toEqual(['b001', 'b004', 'b009']);
    expect(session.items).toHaveLength(level.itemIds.length + 3);
    expect(session.run.rounds[0]!.items).toEqual(session.items);
  });
});
