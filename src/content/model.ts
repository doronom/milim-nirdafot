import type {
  AlsoSynonymsFile,
  BookletFile,
  Content,
  Entry,
  ExtraFile,
  LargeGroupsFile,
  NotSynonymsFile,
  Sentence,
  SentencesFile,
  SensesFile,
} from './types';

export const CUSTOM_CATEGORY_ID = 'custom';

export interface ContentSources {
  booklet: BookletFile;
  extra: ExtraFile;
  sentences: SentencesFile;
  senses: SensesFile;
  alsoSynonyms: AlsoSynonymsFile;
  notSynonyms: NotSynonymsFile;
  largeGroups: LargeGroupsFile;
  custom?: Entry[];
}

/**
 * Merges the booklet, the extra file, generated sentences and the parent's custom words into one model.
 * Hint overrides from senses.json are applied here so booklet.json stays untouched.
 */
export function buildContent(sources: ContentSources): Content {
  const { booklet, extra, sentences, senses, custom = [] } = sources;
  const withHint = <T extends Entry>(e: T): T => (e.id in senses.hints ? { ...e, hint: senses.hints[e.id]! } : e);
  const bookletEntries: Entry[] = booklet.entries.map((e) =>
    withHint({ ...e, source: 'booklet', reviewed: booklet.meta.reviewed }),
  );
  const categories = [...booklet.categories];
  if (custom.length > 0) {
    categories.push({ id: CUSTOM_CATEGORY_ID, order: categories.length + 1, title: 'המילים שלי' });
  }
  return {
    categories,
    entries: [...bookletEntries, ...extra.newEntries.map(withHint), ...custom],
    scales: extra.intensityScales,
    registers: extra.registerSets,
    contexts: extra.contextChoices,
    idioms: extra.idioms,
    sentences: sentences.sentences,
    senseSplits: senses.senses,
    sameMeaning: senses.sameMeaning,
    alsoSynonyms: sources.alsoSynonyms.pairs,
    notSynonyms: sources.notSynonyms.pairs,
    approvedLargeGroups: sources.largeGroups.approved,
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

/** swapWord needs at least one synonym that fits the sentence as written; the rest are flagged in content review. */
export const isSwapEligible = (s: Sentence): boolean => s.fits.length > 0;
