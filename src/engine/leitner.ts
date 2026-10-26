import type { Outcome } from './attempt';
import { addDays } from './dates';

export type Box = 1 | 2 | 3 | 4 | 5;

/** Spaced-repetition state of one practice item (a headword-synonym pair, an idiom, a scale or a register set). */
export interface LeitnerCard {
  box: Box;
  /** Day the item is due again (YYYY-MM-DD). */
  due: string;
  seen: number;
  lapses: number;
  lastSeen: string;
}

export type LeitnerState = Record<string, LeitnerCard>;

/** Days until an item in each box is due again. Box 1 comes back the next day. */
export const INTERVAL_DAYS: Record<Box, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

/**
 * Applies one session's outcome. Correct moves up a box, wrong drops to box 1 (due today); "also correct" and a
 * near miss (a tolerated typo) hold the box.
 */
export function review(card: LeitnerCard | undefined, outcome: Outcome, today: string): LeitnerCard {
  const box = card?.box ?? 1;
  const seen = (card?.seen ?? 0) + 1;
  const lapses = card?.lapses ?? 0;
  if (outcome === 'wrong') return { box: 1, due: today, seen, lapses: lapses + 1, lastSeen: today };
  if (outcome === 'also-correct' || outcome === 'near-miss') {
    return { box, due: card?.due ?? addDays(today, INTERVAL_DAYS[box]), seen, lapses, lastSeen: today };
  }
  const next = (card ? Math.min(5, box + 1) : 2) as Box;
  return { box: next, due: addDays(today, INTERVAL_DAYS[next]), seen, lapses, lastSeen: today };
}

/** An item the child marked "I know this word" starts one box up, without a lapse. */
export function markKnown(card: LeitnerCard | undefined, today: string): LeitnerCard {
  if (card && card.box >= 2) return card;
  return {
    box: 2,
    due: addDays(today, INTERVAL_DAYS[2]),
    seen: card?.seen ?? 0,
    lapses: card?.lapses ?? 0,
    lastSeen: today,
  };
}

/**
 * Folds every answer an item got in one session into one outcome, so a session moves an item at most one box:
 * any wrong answer is a lapse; otherwise any correct answer is a pass; near misses hold; only "also correct" left
 * means the parent will judge, and the box holds too.
 */
export function sessionOutcome(outcomes: readonly Outcome[]): Outcome {
  if (outcomes.includes('wrong')) return 'wrong';
  if (outcomes.includes('correct')) return 'correct';
  if (outcomes.includes('near-miss')) return 'near-miss';
  return 'also-correct';
}

export const isDue = (card: LeitnerCard, today: string): boolean => card.due <= today;

/** Due item keys, weakest first: lower box, then older due date, then more lapses. */
export function dueKeys(state: LeitnerState, today: string): string[] {
  return Object.entries(state)
    .filter(([, c]) => isDue(c, today))
    .sort(
      ([ka, a], [kb, b]) => a.box - b.box || a.due.localeCompare(b.due) || b.lapses - a.lapses || ka.localeCompare(kb),
    )
    .map(([k]) => k);
}

/** Every tracked key, weakest first (for boss levels and the parent dashboard). */
export function weakestKeys(state: LeitnerState): string[] {
  return Object.entries(state)
    .sort(
      ([ka, a], [kb, b]) => a.box - b.box || b.lapses - a.lapses || a.due.localeCompare(b.due) || ka.localeCompare(kb),
    )
    .map(([k]) => k);
}

export function boxDistribution(state: LeitnerState): Record<Box, number> {
  const out: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of Object.values(state)) out[c.box] += 1;
  return out;
}

/**
 * Folds one level into the Leitner state: items the child marked as known start one box up, then every practised
 * item moves by its session outcome.
 */
export function applySession(
  state: LeitnerState,
  perItem: Record<string, Outcome>,
  knownKeys: readonly string[],
  today: string,
): LeitnerState {
  const next = { ...state };
  for (const key of knownKeys) next[key] = markKnown(next[key], today);
  for (const [key, outcome] of Object.entries(perItem)) next[key] = review(next[key], outcome, today);
  return next;
}
