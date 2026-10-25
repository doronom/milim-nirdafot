import { content } from '../src/content';
import { createDisplayWord } from '../src/content/display';
import type { Content } from '../src/content/types';
import { buildSynonymGraph } from '../src/engine/graph';
import type { LevelDef } from '../src/engine/layout';
import type { LeitnerState } from '../src/engine/leitner';
import { buildSynonymLinks } from '../src/engine/links';
import { createResolver } from '../src/games/items';
import { buildLevelSession, type SessionOptions } from '../src/games/session';
import { isPair, type GameEnv, type LevelItem, type PlanContext, type PracticeItem } from '../src/games/types';

export const ctxFor = (c: Content = content, blocked: Iterable<string> = [], reviewedOnly = false): PlanContext => ({
  content: c,
  sentences: { reviewedOnly, blocked: new Set(blocked) },
});

export const envFor = (c: Content = content, extra: Partial<GameEnv> = {}): GameEnv => ({
  ...ctxFor(c),
  graph: buildSynonymGraph(c),
  links: buildSynonymLinks(c),
  pool: c.entries,
  decisions: {},
  displayWord: createDisplayWord(c),
  ...extra,
});

export const sessionFor = (
  level: LevelDef,
  leitner: LeitnerState = {},
  seed = 's',
  { c = content, ...opts }: Partial<SessionOptions> & { c?: Content } = {},
) =>
  buildLevelSession(level, leitner, seed, {
    resolver: createResolver(c),
    ctx: ctxFor(c),
    today: '2026-10-25',
    ...opts,
  });

export const pairs = (items: readonly LevelItem[]): PracticeItem[] => items.filter(isPair);

/** Content with every sentence marked reviewed. */
export const withReviewedSentences = (c: Content): Content => ({
  ...c,
  sentences: c.sentences.map((s) => ({ ...s, reviewed: true })),
});
