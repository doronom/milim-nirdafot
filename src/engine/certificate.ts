const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/**
 * A number in Hebrew letters (gematria), with gershayim before the last letter or a geresh after a single letter:
 * 24 -> כ״ד, 786 -> תשפ״ו, 15 -> ט״ו and 16 -> ט״ז (never spelled with the letters of the divine name).
 */
export function gematria(n: number): string {
  let letters = HUNDREDS[Math.floor((n % 1000) / 100)]!;
  const rest = n % 100;
  if (rest === 15) letters += 'טו';
  else if (rest === 16) letters += 'טז';
  else letters += TENS[Math.floor(rest / 10)]! + ONES[rest % 10]!;
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/**
 * Dates for the certificate, computed when it is shown: the Gregorian date (15.11.2025) and the Hebrew date in Hebrew
 * letters (כ״ד בחשוון תשפ״ו). The month name comes from Intl's Hebrew calendar; day and year are converted here,
 * since engines differ on Hebrew numerals.
 */
export function certificateDates(date: Date): { gregorian: string; hebrew: string } {
  const gregorian = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(
    date,
  );
  const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const asLetters = (v: string) => (/^\d+$/.test(v) ? gematria(Number(v)) : v);
  return { gregorian, hebrew: `${asLetters(value('day'))} ב${value('month')} ${asLetters(value('year'))}` };
}
