import type { BookletFile, Content, Entry, ExtraFile, SentencesFile } from './types';

export const CUSTOM_CATEGORY_ID = 'custom';

/** Merges the booklet, the extra file, generated sentences and the parent's custom words into one model. */
export function buildContent(
  booklet: BookletFile,
  extra: ExtraFile,
  sentences: SentencesFile,
  custom: Entry[] = [],
): Content {
  const bookletEntries: Entry[] = booklet.entries.map((e) => ({
    ...e,
    source: 'booklet',
    reviewed: booklet.meta.reviewed,
  }));
  const categories = [...booklet.categories];
  if (custom.length > 0) {
    categories.push({ id: CUSTOM_CATEGORY_ID, order: categories.length + 1, title: 'המילים שלי' });
  }
  return {
    categories,
    entries: [...bookletEntries, ...extra.newEntries, ...custom],
    scales: extra.intensityScales,
    registers: extra.registerSets,
    contexts: extra.contextChoices,
    idioms: extra.idioms,
    sentences: sentences.sentences,
  };
}

/** Applies the "reviewed content only" setting. Custom words are the parent's own, so they always count as reviewed. */
export function onlyReviewed(content: Content): Content {
  const entries = content.entries.filter((e) => e.reviewed || e.source === 'custom');
  const entryIds = new Set(entries.map((e) => e.id));
  return {
    ...content,
    entries,
    scales: content.scales.filter((s) => s.reviewed),
    registers: content.registers.filter((r) => r.reviewed),
    contexts: content.contexts.filter((c) => c.reviewed),
    idioms: content.idioms.filter((i) => i.reviewed),
    sentences: content.sentences.filter((s) => s.reviewed && entryIds.has(s.entryId)),
  };
}
