import { applyOverrides, type ContentOverrides, type PairDecisionsAdded } from './overrides';
import type { Content } from './types';
import { validateContent, type Issue } from './validate';

/** Hebrew reasons for the validation rules a parent's edit can break. */
const REASON: Record<string, string> = {
  'duplicate-id': 'מזהה כפול',
  'empty-synonyms': 'חייבת להיות לפחות מילה נרדפת אחת',
  'stray-character': 'יש תו לא צפוי (רק אותיות עבריות, רווח יחיד ומקף עברי)',
  'stray-whitespace': 'יש רווחים מיותרים בהתחלה, בסוף או כפולים',
  'duplicate-synonym': 'אותה מילה נרדפת מופיעה פעמיים',
  'self-synonym': 'המילה מופיעה כנרדפת של עצמה',
  'hint-gives-answer': 'הרמז זהה למילה או לאחת הנרדפות ומסגיר את התשובה',
  'homograph-without-hint': 'יש כבר ערך עם אותה מילה; כדי להבדיל ביניהם צריך רמז שונה לכל אחד',
  'bad-difficulty': 'רמת הקושי צריכה להיות 1, 2 או 3',
  'bad-pos': 'חלק הדיבר לא מוכר',
  'unknown-category': 'קטגוריה לא מוכרת',
  'short-scale': 'בסולם עוצמה צריכות להיות לפחות 3 מילים',
  'duplicate-word': 'מילה מופיעה פעמיים',
  'thin-register': 'בקבוצת משלבים צריכות להיות מילים בשני תאים לפחות',
  'answer-not-in-options': 'התשובה חייבת להיות אחת האפשרויות',
  'no-blank': 'המשפט חייב לכלול ___ במקום המילה החסרה',
  'duplicate-option': 'אפשרות מופיעה פעמיים',
  'idiom-answer-missing': 'המשפט לדוגמה חייב לכלול את הביטוי בצורה שמסומנת לבחירה',
  'sentence-missing-headword': 'המשפט חייב לכלול את המילה',
  'fit-not-synonym': 'מילה שמתאימה למשפט חייבת להיות אחת הנרדפות של הערך',
  'sentence-count': 'לכל מילה צריכים להיות משפט אחד או שניים',
  'orphan-sentence': 'המשפט שייך לערך שלא קיים',
  'sense-word-missing': 'הפרדת המשמעויות מתייחסת למילה שכבר לא קיימת בערך',
  'also-synonym-unknown-node': 'זוג נרדפות שאושר מתייחס למילה שכבר לא קיימת',
  'not-synonym-unknown-word': 'מלכודת שאושרה מתייחסת למילה שכבר לא קיימת',
};

/** What an issue's ref points at, in words a parent recognizes. */
function subject(c: Content, ref: string): string {
  const entry = c.entries.find((e) => e.id === ref);
  if (entry) return `"${entry.headword}"`;
  const sentence = c.sentences.find((s) => s.id === ref);
  if (sentence) return `המשפט "${sentence.text}"`;
  const scale = c.scales.find((s) => s.id === ref);
  if (scale) return `הסולם "${scale.theme}"`;
  const register = c.registers.find((r) => r.id === ref);
  if (register) return `קבוצת המשלבים "${register.meaning}"`;
  const context = c.contexts.find((x) => x.id === ref);
  if (context) return `המשפט "${context.sentence}"`;
  const idiom = c.idioms.find((i) => i.id === ref);
  if (idiom) return `הביטוי "${idiom.idiom}"`;
  return ref;
}

export const describeIssue = (c: Content, issue: Issue): string =>
  `${subject(c, issue.ref)}: ${REASON[issue.code] ?? issue.message}`;

export interface EditCheck {
  ok: boolean;
  /** Hebrew explanations of the problems this edit introduces. */
  problems: string[];
}

const key = (i: Issue) => `${i.code}|${i.ref}|${i.message}`;

/**
 * Runs the validate:data rules on the content with the edit and without it. The edit may be saved only if it adds no
 * new error; existing problems elsewhere do not block it.
 */
export function checkEdit(
  base: Content,
  before: ContentOverrides,
  after: ContentOverrides,
  added?: PairDecisionsAdded,
): EditCheck {
  const was = new Set(validateContent(applyOverrides(base, before, added)).errors.map(key));
  const next = applyOverrides(base, after, added);
  const fresh = validateContent(next).errors.filter((i) => !was.has(key(i)));
  return { ok: fresh.length === 0, problems: fresh.map((i) => describeIssue(next, i)) };
}
