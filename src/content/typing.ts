import { stripNiqqud } from './text';

const FINAL_TO_REGULAR: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * The form typed answers are compared in: no niqqud or maqaf, final letters as regular letters (ך/כ, ם/מ, ן/נ, ף/פ,
 * ץ/צ), single spaces. "שקט נפשי" and "שקט  נפשי" compare equal; so do "גלמוד" typed with or without a final letter.
 */
export const normalizeTyped = (s: string): string =>
  stripNiqqud(s)
    .replace(/[־-]/g, ' ')
    .replace(/[ךםןףץ]/g, (ch) => FINAL_TO_REGULAR[ch]!)
    .replace(/\s+/g, ' ')
    .trim();

/** Levenshtein distance (insert, delete, substitute), computed with one row. */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

export type TypedVerdict = { kind: 'exact'; word: string } | { kind: 'typo'; word: string } | { kind: 'wrong' };

/**
 * Judges a typed answer against the accepted words: an exact match (after normalization), a near miss of one edit
 * (accepted, with a "בדוק איות" nudge), or wrong. Near misses only count for words of three letters or more.
 */
export function judgeTyped(typed: string, accepted: readonly string[]): TypedVerdict {
  const t = normalizeTyped(typed);
  if (t.length === 0) return { kind: 'wrong' };
  const exact = accepted.find((w) => normalizeTyped(w) === t);
  if (exact) return { kind: 'exact', word: exact };
  const near = accepted.find((w) => normalizeTyped(w).length >= 3 && editDistance(normalizeTyped(w), t) === 1);
  return near ? { kind: 'typo', word: near } : { kind: 'wrong' };
}
