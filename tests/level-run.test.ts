import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { buildLayout } from '../src/engine/layout';
import {
  finishRound,
  isRunDone,
  levelOutcome,
  planStages,
  roundAccuracy,
  starsFor,
  startRun,
  MAX_ROUNDS,
} from '../src/engine/level-run';
import { createRng } from '../src/engine/rng';
import { GAME_CATALOG, REVIEW_GAME } from '../src/games/registry';
import { buildLevelSession } from '../src/games/session';
import type { Answer, PracticeItem } from '../src/games/types';

const level = buildLayout(content).worlds[0]!.stations[0]!.levels[0]!;
const session = buildLevelSession(level, content, {}, 'seed');
const items = session.items;
const all = (outcome: Answer['outcome'], list: PracticeItem[] = items): Answer[] =>
  list.map((i) => ({ itemKey: i.key, outcome }));

describe('level plan', () => {
  it('orders World 1 rounds recognition -> discrimination -> production', () => {
    expect(planStages(1, GAME_CATALOG, items, createRng(1), content)).toEqual(['pickSynonym', 'dragPairs', 'memory']);
    expect(session.run.rounds.map((r) => r.gameId)).toEqual(['pickSynonym', 'dragPairs', 'memory']);
  });

  it('teaches every entry of the level with its least-known synonym', () => {
    expect(session.entries.map((e) => e.id)).toEqual(level.itemIds);
    const strong = { box: 5 as const, due: '2099-01-01', seen: 9, lapses: 0, lastSeen: '2026-10-25' };
    const first = session.entries[0]!;
    const known = buildLevelSession(level, content, { [`${first.id}|${first.synonyms[0]}`]: strong }, 'seed');
    expect(known.items[0]!.synonym).toBe(first.synonyms[1]);
  });

  it('starts at tier 1 with 3 options in World 1', () => {
    expect(session.run.difficulty).toEqual({ tier: 1, options: 3 });
  });
});

describe('running a level', () => {
  it('raises difficulty for the next round after 90%+', () => {
    const run = finishRound(session.run, { answers: all('correct') }, REVIEW_GAME);
    expect(run.index).toBe(1);
    expect(run.rounds[1]!.difficulty).toEqual({ tier: 2, options: 4 });
    expect(run.rounds[0]!.difficulty).toEqual({ tier: 1, options: 3 });
  });

  it('re-inserts missed items once after a weak round', () => {
    const missed = items.slice(0, 4);
    const answers = [...all('wrong', missed), ...all('correct', items.slice(4))];
    let run = finishRound(session.run, { answers }, REVIEW_GAME);
    expect(roundAccuracy(answers)).toBeLessThan(0.6);
    expect(run.reinserted).toEqual(missed.map((i) => i.key));
    // The next round already holds every item, so nothing is duplicated.
    expect(run.rounds[1]!.items).toHaveLength(items.length);
    run = finishRound(run, { answers: all('wrong') }, REVIEW_GAME);
    // Already re-inserted items do not come back a second time.
    expect(run.reinserted).toHaveLength(items.length);
  });

  it('adds an extra review round after the last stage, up to 4 rounds', () => {
    let run = finishRound(session.run, { answers: all('correct') }, REVIEW_GAME);
    run = finishRound(run, { answers: all('correct') }, REVIEW_GAME);
    run = finishRound(run, { answers: all('wrong') }, REVIEW_GAME);
    expect(run.rounds).toHaveLength(MAX_ROUNDS);
    expect(run.rounds[3]!.gameId).toBe('pickSynonym');
    expect(isRunDone(run)).toBe(false);
    run = finishRound(run, { answers: all('wrong') }, REVIEW_GAME);
    expect(run.rounds).toHaveLength(MAX_ROUNDS);
    expect(isRunDone(run)).toBe(true);
  });

  it('counts "also correct" as not a mistake and scores stars by accuracy', () => {
    expect(
      roundAccuracy([
        { itemKey: 'a', outcome: 'also-correct' },
        { itemKey: 'b', outcome: 'correct' },
      ]),
    ).toBe(1);
    expect([starsFor(1), starsFor(0.9), starsFor(0.8), starsFor(0.75), starsFor(0.2)]).toEqual([3, 3, 2, 2, 1]);
  });

  it('summarizes a level per item for the Leitner update', () => {
    let run = startRun(['pickSynonym', 'memory'], items, { tier: 1, options: 3 });
    run = finishRound(
      run,
      { answers: [{ itemKey: items[0]!.key, outcome: 'wrong' }, ...all('correct', items.slice(1))] },
      REVIEW_GAME,
    );
    run = finishRound(run, { answers: all('correct') }, REVIEW_GAME);
    const outcome = levelOutcome(run);
    expect(outcome.perItem[items[0]!.key]).toBe('wrong');
    expect(outcome.perItem[items[1]!.key]).toBe('correct');
    expect(outcome.missed).toEqual([items[0]!.key]);
    expect(outcome.stars).toBe(3);
  });
});
