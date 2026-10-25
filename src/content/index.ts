import booklet from '../data/booklet.json';
import extra from '../data/synonyms-extra.json';
import sentences from '../data/sentences.json';
import senses from '../data/senses.json';
import { buildContent } from './model';
import type { BookletFile, ExtraFile, SentencesFile, SensesFile } from './types';

export const sources = {
  booklet: booklet as BookletFile,
  extra: extra as ExtraFile,
  sentences: sentences as SentencesFile,
  senses: senses as SensesFile,
};

export const content = buildContent(sources);

export * from './types';
export * from './model';
