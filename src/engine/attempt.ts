/**
 * How one answer ended. 'also-correct' is a wrong pick the child flagged with "גם זו תשובה נכונה!": it is queued for
 * parent review and never counts as a mistake, so the Leitner scheduler must not demote on it.
 */
export type Outcome = 'correct' | 'wrong' | 'also-correct';

export interface Attempt {
  /** Leitner item the question was about, e.g. "b031|ענק". */
  itemKey: string;
  outcome: Outcome;
  /** The option the child picked, when it differs from the answer. */
  chosen?: string;
  at: string;
}

export const countsAsMistake = (outcome: Outcome): boolean => outcome === 'wrong';

/** Turns a wrong attempt into an "also correct" claim. Correct attempts stay as they are. */
export function claimAlsoCorrect(attempt: Attempt): Attempt {
  return attempt.outcome === 'wrong' ? { ...attempt, outcome: 'also-correct' } : attempt;
}
