import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { buildLayout } from '../src/engine/layout';
import type { LeitnerState } from '../src/engine/leitner';
import { createRng } from '../src/engine/rng';
import { blockedSentenceIds, type SentenceReport } from '../src/engine/sentence-reports';
import { buildContextRound, filled, fitsContext } from '../src/games/contextChoice/build';
import { createResolver, sourceId } from '../src/games/items';
import { buildLadderRound, isOrdered, isStronger } from '../src/games/intensityLadder/build';
import { BINS, buildRegisterRound, wordsOf } from '../src/games/registerSort/build';
import { isPlayableLevel } from '../src/games/session';
import { isContext, isRegister, isScale, type LevelItem } from '../src/games/types';
import { sessionFor } from './helpers';

const layout = buildLayout(content);
const w3 = layout.worlds[2]!;
const station = (kind: string) => w3.stations.find((s) => s.kind === kind)!;
const difficulty = { tier: 3 as const, options: 3 as const };
const resolver = createResolver(content);
const itemsOf = (kind: string): LevelItem[] =>
  station(kind)
    .levels.flatMap((l) => l.itemIds)
    .map((id) => resolver.byId(id)!);

describe('World 3 levels', () => {
  it('are playable, including review and boss levels', () => {
    for (const s of w3.stations) for (const l of s.levels) expect(isPlayableLevel(l, resolver), l.id).toBe(true);
    expect(isPlayableLevel(w3.boss, resolver)).toBe(true);
  });

  it('play one game per content type through all three stages', () => {
    for (const [kind, game] of [
      ['scales', 'intensityLadder'],
      ['registers', 'registerSort'],
      ['contexts', 'contextChoice'],
    ] as const) {
      const session = sessionFor(station(kind).levels[0]!);
      expect(session.run.rounds.map((r) => [r.gameId, r.stage])).toEqual([
        [game, 'recognition'],
        [game, 'discrimination'],
        [game, 'production'],
      ]);
      expect(session.learn.length).toBe(station(kind).levels[0]!.itemIds.length);
    }
  });

  it('give pair guests in a scales level their own extra round', () => {
    const due = { box: 1 as const, due: '2026-10-01', seen: 1, lapses: 1, lastSeen: '2026-10-01' };
    const leitner: LeitnerState = { 'b031|ענק': due, 'b058|זעיר': due, 'b035|לוהט': due };
    const session = sessionFor(station('scales').levels[0]!, leitner);
    expect(session.items.filter((i) => i.isGuest)).toHaveLength(3);
    expect(session.run.rounds.map((r) => r.gameId)).toEqual([
      'intensityLadder',
      'intensityLadder',
      'intensityLadder',
      'pickSynonym',
    ]);
    expect(session.run.rounds[3]!.items.map(sourceId).sort()).toEqual(['b031', 'b035', 'b058']);
  });

  it('build review levels from due items first, then the world material', () => {
    const review = station('review').levels[0]!;
    const due = { box: 1 as const, due: '2026-10-01', seen: 1, lapses: 1, lastSeen: '2026-10-01' };
    const session = sessionFor(review, { scale05: due, ctx03: due }, 's', {
      reviewFallback: w3.stations.flatMap((s) => s.levels.flatMap((l) => l.itemIds)),
    });
    expect(session.learn).toEqual([]);
    expect(session.items).toHaveLength(review.drawCount!);
    expect(session.items.map((i) => i.key)).toEqual(expect.arrayContaining(['scale05', 'ctx03']));
  });
});

describe('intensityLadder', () => {
  const scales = itemsOf('scales');
  it('recognition asks which of two words is stronger', () => {
    const round = buildLadderRound(scales, difficulty, createRng(1), 'recognition');
    if (round.mode !== 'stronger') throw new Error('mode');
    for (const q of round.questions) {
      const words = q.item.scale.weakToStrong;
      expect(words.indexOf(q.stronger)).toBe(Math.max(...q.pair.map((w) => words.indexOf(w))));
      expect(q.pair.filter((w) => isStronger(q, w))).toEqual([q.stronger]);
    }
  });

  it('discrimination orders three words, production the whole scale, never pre-sorted', () => {
    for (const stage of ['discrimination', 'production'] as const) {
      const round = buildLadderRound(scales, difficulty, createRng(stage), stage);
      if (round.mode !== 'order') throw new Error('mode');
      for (const q of round.questions) {
        const words = q.item.scale.weakToStrong;
        expect(q.order.length).toBe(stage === 'production' ? words.length : Math.min(3, words.length));
        expect(q.order.map((w) => words.indexOf(w))).toEqual(
          [...q.order.map((w) => words.indexOf(w))].sort((a, b) => a - b),
        );
        expect(isOrdered(q, q.bank)).toBe(false);
        expect(isOrdered(q, q.order)).toBe(true);
      }
    }
  });
});

describe('registerSort', () => {
  const sets = itemsOf('registers').filter(isRegister);
  it('recognition asks the register of one word per set', () => {
    const round = buildRegisterRound(sets, difficulty, createRng(1), 'recognition');
    if (round.mode !== 'classify') throw new Error('mode');
    for (const q of round.questions) expect(q.item.register[q.bin]).toContain(q.word);
  });

  it('discrimination sorts one set per board and marks unused bins empty', () => {
    const round = buildRegisterRound(sets, difficulty, createRng(1), 'discrimination');
    if (round.mode !== 'sort') throw new Error('mode');
    expect(round.boards).toHaveLength(sets.length);
    for (const b of round.boards) {
      expect(b.words).toHaveLength(wordsOf(b.items[0]!).length);
      for (const bin of BINS) expect(b.emptyBins.includes(bin)).toBe(b.items[0]!.register[bin].length === 0);
    }
  });

  it('production sorts two sets at once, never two that share a word', () => {
    const round = buildRegisterRound(sets, difficulty, createRng(2), 'production');
    if (round.mode !== 'sort') throw new Error('mode');
    expect(round.boards.flatMap((b) => b.items).length).toBe(sets.length);
    for (const b of round.boards) {
      const words = b.words.map((w) => w.word);
      expect(new Set(words).size).toBe(words.length);
    }
    expect(round.boards.some((b) => b.items.length === 2)).toBe(true);
  });
});

describe('contextChoice', () => {
  const contexts = itemsOf('contexts').filter(isContext);
  it('choose mode keeps the data options and exactly one fits', () => {
    const round = buildContextRound(contexts, difficulty, createRng(1), 'recognition');
    expect(round.mode).toBe('choose');
    for (const q of round.questions) {
      expect([...q.options].sort()).toEqual([...q.item.context.options].sort());
      expect(q.options.filter((o) => fitsContext(q.item, o))).toEqual([q.item.context.answer]);
      expect(filled(q, '___')).toBe(q.item.context.sentence);
    }
  });

  it('discrimination shows full sentences to pick from', () => {
    expect(buildContextRound(contexts, difficulty, createRng(1), 'discrimination').mode).toBe('sentence');
  });

  it('all builders are deterministic for a seed', () => {
    const items = [...itemsOf('scales'), ...itemsOf('registers'), ...itemsOf('contexts')];
    for (const build of [buildLadderRound, buildRegisterRound, buildContextRound]) {
      for (const stage of ['recognition', 'discrimination', 'production'] as const) {
        expect(build(items, difficulty, createRng('d'), stage)).toEqual(
          build(items, difficulty, createRng('d'), stage),
        );
      }
    }
  });
});

describe('sentence reports', () => {
  const report = (sentenceId: string, status: SentenceReport['status']): SentenceReport => ({
    sentenceId,
    entryId: 'b001',
    gameId: 'swapWord',
    reportedAt: '2026-10-25',
    count: 1,
    status,
  });
  it('take an unreviewed sentence out of play while pending, and after removal', () => {
    const sentences = content.sentences;
    expect(blockedSentenceIds([report('sent-b001-1', 'pending')], sentences).has('sent-b001-1')).toBe(true);
    expect(blockedSentenceIds([report('sent-b001-1', 'kept')], sentences).has('sent-b001-1')).toBe(false);
  });

  it('never take an approved sentence out on a report alone', () => {
    const sentences = content.sentences.map((s) => (s.id === 'sent-b001-1' ? { ...s, reviewed: true } : s));
    expect(blockedSentenceIds([report('sent-b001-1', 'pending')], sentences).has('sent-b001-1')).toBe(false);
    expect(blockedSentenceIds([report('sent-b001-1', 'removed')], sentences).has('sent-b001-1')).toBe(true);
  });
});

it('scales test helper sanity', () => {
  expect(itemsOf('scales').every(isScale)).toBe(true);
});
