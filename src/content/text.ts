const HEB_LETTER = 'א-ת';
// Cantillation and vowel points, excluding the maqaf (U+05BE).
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
export const HAS_NIQQUD = /[֑-ֽֿ-ׇ]/;
const PREFIXES = '[ובכלמשה]{0,3}';

export const stripNiqqud = (s: string): string => s.replace(NIQQUD, '');
/** The comparison form of a word: no niqqud, no trailing maqaf, trimmed. */
export const normalizeWord = (s: string): string => stripNiqqud(s).replace(/־$/, '').trim();

/** True when `text` contains `word` as a whole word, optionally behind one-letter prefixes (ו, ה, ב, ל, מ, ש, כ). */
export function containsWord(text: string, word: string): boolean {
  const escaped = normalizeWord(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^${HEB_LETTER}])${PREFIXES}${escaped}($|[^${HEB_LETTER}])`);
  return re.test(stripNiqqud(text));
}
