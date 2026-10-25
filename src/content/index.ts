import booklet from '../data/booklet.json';
import extra from '../data/synonyms-extra.json';
import sentences from '../data/sentences.json';
import { buildContent } from './model';
import type { BookletFile, ExtraFile, SentencesFile } from './types';

export const bookletFile = booklet as BookletFile;
export const extraFile = extra as ExtraFile;
export const sentencesFile = sentences as SentencesFile;

export const content = buildContent(bookletFile, extraFile, sentencesFile);

export * from './types';
export * from './model';
