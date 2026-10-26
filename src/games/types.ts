import type { ComponentType } from 'react';
import type { GameId, WorldId } from '../config/game';
import type { Content, Entry } from '../content/types';
import type { Outcome } from '../engine/attempt';
import type { PairDecisions, Tier } from '../engine/distractors';
import type { SynonymGraph } from '../engine/graph';
import type { SynonymLinks } from '../engine/links';
import type { Rng } from '../engine/rng';
import type { Difficulty } from '../engine/adaptive';

/** recognition -> discrimination -> production: the order of rounds inside a level. */
export type Stage = 'recognition' | 'discrimination' | 'production';

/** One Leitner-tracked thing to practise. For entries: a headword-synonym pair. */
export interface PracticeItem {
  key: string;
  entry: Entry;
  synonym: string;
  /** A due item from an earlier station or world, mixed in for review (milestone 4 fills these). */
  isGuest?: boolean;
}

export interface Answer {
  itemKey: string;
  outcome: Outcome;
  /** What the child picked or matched, when it was not the expected word. */
  chosen?: string;
}

export interface RoundResult {
  answers: Answer[];
}

/** Everything round builders need beyond the items: built once per level session. */
export interface GameEnv {
  content: Content;
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
  onDone: (result: RoundResult) => void;
  /** "גם זו תשובה נכונה!": queue a wrong option for parent review. */
  onAlsoCorrect: (item: PracticeItem, word: string, nodeId: string) => void;
}

/** The shared mini-game interface. buildRound is deterministic for a given rng seed. */
export interface GameDefinition<R = unknown> {
  id: GameId;
  minWorld: WorldId;
  stage: Stage;
  /** Smallest number of items the game can play with. */
  minItems: number;
  buildRound: (items: PracticeItem[], difficulty: Difficulty, rng: Rng) => R;
  Component: ComponentType<GameProps<R>>;
}

export type { Tier };
