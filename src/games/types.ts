import type { ComponentType } from 'react';
import type { GameId, WorldId } from '../config/game';
import type { Content, ContextChoice, Entry, Idiom, IntensityScale, RegisterSet, Sentence } from '../content/types';
import type { Difficulty } from '../engine/adaptive';
import type { Outcome } from '../engine/attempt';
import type { PairDecisions, Tier } from '../engine/distractors';
import type { SynonymGraph } from '../engine/graph';
import type { SynonymLinks } from '../engine/links';
import type { Rng } from '../engine/rng';

/** recognition -> discrimination -> production: the order of rounds inside a level. */
export type Stage = 'recognition' | 'discrimination' | 'production';

interface ItemBase {
  /** Leitner key: "entryId|synonym" for pairs, the item id otherwise. */
  key: string;
  /** A due item from an earlier station or world, mixed in for review. */
  isGuest?: boolean;
}

/** A headword-synonym pair (worlds 1-2 and custom words). */
export interface PracticeItem extends ItemBase {
  kind: 'pair';
  entry: Entry;
  synonym: string;
}

export interface ScaleItem extends ItemBase {
  kind: 'scale';
  scale: IntensityScale;
}

export interface RegisterItem extends ItemBase {
  kind: 'register';
  register: RegisterSet;
}

export interface ContextItem extends ItemBase {
  kind: 'context';
  context: ContextChoice;
}

export interface IdiomItem extends ItemBase {
  kind: 'idiom';
  idiom: Idiom;
}

/** Anything a level can teach and the Leitner scheduler can track. */
export type LevelItem = PracticeItem | ScaleItem | RegisterItem | ContextItem | IdiomItem;

export const isPair = (i: LevelItem): i is PracticeItem => i.kind === 'pair';
export const isScale = (i: LevelItem): i is ScaleItem => i.kind === 'scale';
export const isRegister = (i: LevelItem): i is RegisterItem => i.kind === 'register';
export const isContext = (i: LevelItem): i is ContextItem => i.kind === 'context';
export const isIdiom = (i: LevelItem): i is IdiomItem => i.kind === 'idiom';

export interface Answer {
  itemKey: string;
  outcome: Outcome;
  /** What the child picked or matched, when it was not the expected word. */
  chosen?: string;
}

export interface RoundResult {
  answers: Answer[];
}

/** Which example sentences swapWord may use. */
export interface SentencePolicy {
  /** The "reviewed sentences only" setting (default off). */
  reviewedOnly: boolean;
  /** Sentences reported in game and not approved: out of play until the parent decides. */
  blocked: ReadonlySet<string>;
}

/** What planning needs to know about the content, beyond the items. */
export interface PlanContext {
  content: Content;
  sentences: SentencePolicy;
}

/** Everything round builders need beyond the items: built once per level session. */
export interface GameEnv extends PlanContext {
  graph: SynonymGraph;
  links: SynonymLinks;
  /** Entries distractors may come from (the reviewed-only subset when that setting is on). */
  pool: readonly Entry[];
  decisions: PairDecisions;
  displayWord: (word: string) => string;
}

export interface GameProps<R> {
  round: R;
  difficulty: Difficulty;
  /** The stage this round plays; games with several modes pick theirs from it. */
  stage: Stage;
  onDone: (result: RoundResult) => void;
  /**
   * "גם זו תשובה נכונה!": queue the child's answer for parent review. For pairs `word` is the offered option and
   * `nodeId` its graph node; for other items `word` is the child's answer.
   */
  onAlsoCorrect: (item: LevelItem, word: string, nodeId?: string) => void;
  /** "דווח על משפט": take a sentence out of play and queue it for parent review. */
  onReportSentence: (sentence: Sentence) => void;
}

/** What the planner needs about a game: the stages it can serve and which items it can play. */
export interface GameInfo {
  id: GameId;
  stages: readonly Stage[];
  /** Smallest number of playable items the game needs. */
  minItems: number;
  playable: (items: readonly LevelItem[], ctx: PlanContext) => readonly LevelItem[];
}

/**
 * The shared mini-game interface. buildRound is deterministic for a given rng seed; it receives only items the game's
 * `playable` accepts, and the stage it plays.
 */
export interface GameDefinition<R = unknown> extends GameInfo {
  minWorld: WorldId;
  buildRound: (items: LevelItem[], difficulty: Difficulty, rng: Rng, stage: Stage) => R;
  Component: ComponentType<GameProps<R>>;
}

export type { Tier };
