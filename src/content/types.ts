export type Source = 'booklet' | 'extra' | 'custom';
export type Pos = 'noun' | 'adj' | 'verb' | 'adv';
export type Difficulty = 1 | 2 | 3;

export const POS_VALUES: readonly Pos[] = ['noun', 'adj', 'verb', 'adv'];

export interface Category {
  id: string;
  order: number;
  title: string;
  /** Entry count printed in the booklet; only booklet categories carry it. */
  expectedCount?: number;
}

/** Fields every reviewable content item carries. */
export interface Provenance {
  source: Source;
  reviewed: boolean;
}

export interface Entry extends Provenance {
  id: string;
  categoryId: string;
  headword: string;
  /** Disambiguates homographs, e.g. ישן "לא חדש" vs ישן "במיטה". */
  hint: string | null;
  synonyms: string[];
  difficulty: Difficulty;
  pos: Pos;
}

export interface IntensityScale extends Provenance {
  id: string;
  theme: string;
  weakToStrong: string[];
}

export interface RegisterSet extends Provenance {
  id: string;
  meaning: string;
  everyday: string[];
  standard: string[];
  literary: string[];
}

export interface ContextChoice extends Provenance {
  id: string;
  sentence: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface Idiom extends Provenance {
  id: string;
  idiom: string;
  meaning: string;
  example: string;
  /** The exact (possibly inflected) form of the idiom inside `example`, used as the fill-in blank. */
  exampleAnswer: string;
}

export interface Sentence {
  id: string;
  entryId: string;
  text: string;
  /** Synonyms of the entry that can replace the headword in this sentence as written. */
  fits: string[];
  reviewed: boolean;
}

/** One meaning of a spelling that the synonym graph must keep apart from its other meanings. */
export interface Sense {
  key: string;
  gloss: string;
  /** Entry or register-set ids whose occurrence of the word carries this sense. */
  items: string[];
}

export interface SenseSplit {
  word: string;
  senses: Sense[];
}

export interface Content {
  categories: Category[];
  entries: Entry[];
  scales: IntensityScale[];
  registers: RegisterSet[];
  contexts: ContextChoice[];
  idioms: Idiom[];
  sentences: Sentence[];
  senseSplits: SenseSplit[];
  /** Spellings deliberately left as one node even though they serve two parts of speech (same meaning). */
  sameMeaning: string[];
}

/** Raw file shapes (src/data/*.json). */
export interface BookletFile {
  meta: { source: string; reviewed: boolean; note: string };
  categories: Category[];
  entries: Omit<Entry, keyof Provenance>[];
}

export interface ExtraFile {
  meta: { reviewed: boolean; categoryIds: string[] } & Record<string, unknown>;
  newEntries: Entry[];
  intensityScales: IntensityScale[];
  registerSets: RegisterSet[];
  contextChoices: ContextChoice[];
  idioms: Idiom[];
}

export interface SentencesFile {
  meta: { note: string };
  sentences: Sentence[];
}

export interface SensesFile {
  meta: { note: string };
  hints: Record<string, string>;
  senses: SenseSplit[];
  sameMeaning: string[];
}
