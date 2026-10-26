import type { Rng } from './rng';

/** Seconds the gate button must be held before the question appears. */
export const GATE_HOLD_SECONDS = 3;

export interface GateQuestion {
  a: number;
  b: number;
}

/** A multiplication a 10-year-old is unlikely to answer at a glance: both factors 6-9, or one of them 12-15. */
export function gateQuestion(rng: Rng): GateQuestion {
  const a = 6 + rng.int(4);
  const b = rng.next() < 0.5 ? 6 + rng.int(4) : 12 + rng.int(4);
  return rng.next() < 0.5 ? { a, b } : { a: b, b: a };
}

export const gateAnswer = (q: GateQuestion): number => q.a * q.b;
