import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../src/engine/dates';
import {
  applySession,
  boxDistribution,
  dueKeys,
  markKnown,
  review,
  sessionOutcome,
  weakestKeys,
  type LeitnerState,
} from '../src/engine/leitner';

const today = '2026-10-25';

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 16)).toBe('2027-01-16');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('Leitner scheduler', () => {
  it('moves a new item to box 2 on a correct first answer', () => {
    expect(review(undefined, 'correct', today)).toEqual({
      box: 2,
      due: '2026-10-27',
      seen: 1,
      lapses: 0,
      lastSeen: today,
    });
  });

  it('promotes one box per correct session up to box 5, with growing intervals', () => {
    let card = review(undefined, 'correct', today);
    const dues = [card.due];
    for (let i = 0; i < 5; i++) {
      card = review(card, 'correct', today);
      dues.push(card.due);
    }
    expect(card.box).toBe(5);
    expect(dues).toEqual(['2026-10-27', '2026-10-29', '2026-11-02', '2026-11-10', '2026-11-10', '2026-11-10']);
  });

  it('drops to box 1, due today, on a wrong answer, and counts the lapse', () => {
    const card = review(review(review(undefined, 'correct', today), 'correct', today), 'wrong', today);
    expect(card).toMatchObject({ box: 1, due: today, lapses: 1, seen: 3 });
  });

  it('never demotes on "also correct"', () => {
    const before = review(review(undefined, 'correct', today), 'correct', today);
    const after = review(before, 'also-correct', '2026-10-26');
    expect(after.box).toBe(before.box);
    expect(after.due).toBe(before.due);
    expect(after.lapses).toBe(0);
  });

  it('starts known words one box up', () => {
    expect(markKnown(undefined, today).box).toBe(2);
    const strong = { box: 4 as const, due: today, seen: 3, lapses: 0, lastSeen: today };
    expect(markKnown(strong, today)).toBe(strong);
  });

  it('folds a session to one outcome per item', () => {
    expect(sessionOutcome(['correct', 'wrong', 'correct'])).toBe('wrong');
    expect(sessionOutcome(['also-correct', 'correct'])).toBe('correct');
    expect(sessionOutcome(['also-correct'])).toBe('also-correct');
  });

  it('lists due items weakest first, and all items weakest first', () => {
    const state: LeitnerState = {
      a: { box: 3, due: '2026-10-20', seen: 4, lapses: 0, lastSeen: '2026-10-16' },
      b: { box: 1, due: '2026-10-25', seen: 2, lapses: 2, lastSeen: '2026-10-25' },
      c: { box: 1, due: '2026-10-24', seen: 2, lapses: 1, lastSeen: '2026-10-24' },
      d: { box: 2, due: '2026-10-30', seen: 1, lapses: 0, lastSeen: '2026-10-28' },
    };
    expect(dueKeys(state, today)).toEqual(['c', 'b', 'a']);
    expect(weakestKeys(state)).toEqual(['b', 'c', 'd', 'a']);
    expect(boxDistribution(state)).toEqual({ 1: 2, 2: 1, 3: 1, 4: 0, 5: 0 });
  });

  it('applies a whole level: known words first, then outcomes', () => {
    const next = applySession({}, { x: 'correct', y: 'wrong' }, ['x', 'z'], today);
    expect(next.x!.box).toBe(3);
    expect(next.y!.box).toBe(1);
    expect(next.z!.box).toBe(2);
  });
});
