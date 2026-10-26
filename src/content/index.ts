import booklet from '../data/booklet.json';
import extra from '../data/synonyms-extra.json';
import sentences from '../data/sentences.json';
import senses from '../data/senses.json';
import alsoSynonyms from '../data/also-synonyms.json';
import notSynonyms from '../data/not-synonyms.json';
import largeGroups from '../data/large-groups.json';
import customWords from '../data/custom-words.json';
import { buildContent } from './model';
import type {
  AlsoSynonymsFile,
  BookletFile,
  Entry,
  ExtraFile,
  LargeGroupsFile,
  NotSynonymsFile,
  SentencesFile,
  SensesFile,
} from './types';

export const sources = {
  booklet: booklet as BookletFile,
  extra: extra as ExtraFile,
  sentences: sentences as SentencesFile,
  senses: senses as SensesFile,
  alsoSynonyms: alsoSynonyms as AlsoSynonymsFile,
  notSynonyms: notSynonyms as NotSynonymsFile,
  largeGroups: largeGroups as LargeGroupsFile,
  /** The parent's words committed with apply:content-changes. */
  custom: customWords as Entry[],
};

export const content = buildContent(sources);

export * from './types';
export * from './model';
