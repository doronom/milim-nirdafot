import type { ContentOverrides, OverrideKind, ReviewDecision } from './overrides';
import type { Content } from './types';

export type ReviewFilter = 'booklet' | 'extra' | 'custom' | Exclude<OverrideKind, 'entries'>;

export const FILTER_LABEL: Record<ReviewFilter, string> = {
  booklet: 'חוברת',
  extra: 'מילים נוספות',
  custom: 'מילים שלי',
  scales: 'סולמות',
  registers: 'משלבים',
  contexts: 'הקשר',
  idioms: 'ניבים',
  sentences: 'משפטים',
};

/** One item in content review, whatever its kind. */
export interface ReviewItem {
  kind: OverrideKind;
  filter: ReviewFilter;
  id: string;
  title: string;
  detail: string;
  reviewed: boolean;
  hidden: boolean;
  edited: boolean;
  decision?: ReviewDecision;
  /** Text searched by the filter box. */
  text: string;
}

/** Every reviewable item of the content (overrides applied, hidden items included), in data order. */
export function reviewItems(full: Content, ov: ContentOverrides): ReviewItem[] {
  const headword = new Map(full.entries.map((e) => [e.id, e.headword]));
  const make = (
    kind: OverrideKind,
    filter: ReviewFilter,
    x: { id: string; reviewed: boolean; hidden?: boolean },
    title: string,
    detail: string,
  ): ReviewItem => ({
    kind,
    filter,
    id: x.id,
    title,
    detail,
    reviewed: x.reviewed,
    hidden: Boolean(x.hidden),
    edited: x.id in ov[kind],
    decision: ov.decisions[x.id],
    text: `${title} ${detail}`,
  });
  return [
    ...full.entries.map((e) =>
      make('entries', e.source, e, e.hint ? `${e.headword} (${e.hint})` : e.headword, e.synonyms.join(', ')),
    ),
    ...full.scales.map((s) => make('scales', 'scales', s, s.theme, s.weakToStrong.join(' < '))),
    ...full.registers.map((r) =>
      make(
        'registers',
        'registers',
        r,
        r.meaning,
        [r.everyday, r.standard, r.literary].map((l) => l.join(', ')).join(' | '),
      ),
    ),
    ...full.contexts.map((c) => make('contexts', 'contexts', c, c.sentence, `${c.options.join(' / ')}: ${c.answer}`)),
    ...full.idioms.map((i) => make('idioms', 'idioms', i, i.idiom, i.meaning)),
    ...full.sentences.map((s) =>
      make(
        'sentences',
        'sentences',
        s,
        s.text,
        `${headword.get(s.entryId) ?? s.entryId}: ${s.fits.join(', ') || 'אין נרדפת שמתאימה'}`,
      ),
    ),
  ];
}

/** Drafts: unreviewed items and sentences still waiting for (or holding) a decision. Custom words are the parent's. */
export const draftItems = (items: readonly ReviewItem[]): ReviewItem[] =>
  items.filter((i) => i.filter !== 'custom' && (!i.reviewed || i.decision !== undefined));

/** A short name for an item in the activity log. */
export function itemTitle(full: Content, kind: OverrideKind, id: string): string {
  const find = <T extends { id: string }>(list: readonly T[]) => list.find((x) => x.id === id);
  switch (kind) {
    case 'entries':
      return find(full.entries)?.headword ?? id;
    case 'scales':
      return `סולם "${find(full.scales)?.theme ?? id}"`;
    case 'registers':
      return `משלבים "${find(full.registers)?.meaning ?? id}"`;
    case 'contexts':
      return `הקשר "${find(full.contexts)?.answer ?? id}"`;
    case 'idioms':
      return `ניב "${find(full.idioms)?.idiom ?? id}"`;
    case 'sentences':
      return `משפט "${find(full.sentences)?.text ?? id}"`;
  }
}
