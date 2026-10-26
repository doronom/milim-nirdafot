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

/** Typos are tolerated only on answers this long (letters, after normalization); spelling matters on short words. */
export const TYPO_MIN_LETTERS = 4;

const letterCount = (s: string) => s.replace(/\s/g, '').length;

/**
 * Judges a typed answer against the accepted words: an exact match (after normalization), a slip of one edit from an
 * answer of 4+ letters (a "בדוק את האיות" nudge, no mistake but no promotion either), or wrong. A typed string that is
 * itself another word in the data (`knownWords`, normalized with normalizeTyped) is never a slip: it is that word.
 */
export function judgeTyped(
  typed: string,
  accepted: readonly string[],
  knownWords: ReadonlySet<string> = new Set(),
): TypedVerdict {
  const t = normalizeTyped(typed);
  if (t.length === 0) return { kind: 'wrong' };
  const exact = accepted.find((w) => normalizeTyped(w) === t);
  if (exact) return { kind: 'exact', word: exact };
  if (knownWords.has(t)) return { kind: 'wrong' };
  const near = accepted.find(
    (w) => letterCount(normalizeTyped(w)) >= TYPO_MIN_LETTERS && editDistance(normalizeTyped(w), t) === 1,
  );
  return near ? { kind: 'typo', word: near } : { kind: 'wrong' };
}

/** Every word in the content (headwords, synonyms, register words), normalized for typed comparison. */
export function typedVocabulary(words: Iterable<string>): Set<string> {
  return new Set([...words].map(normalizeTyped));
}
