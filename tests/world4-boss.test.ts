import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { buildLayout, worldLevels } from '../src/engine/layout';
import type { LeitnerState } from '../src/engine/leitner';
import { finishRound, planSinglePass } from '../src/engine/level-run';
import {
  initialProgress,
  isLevelDone,
  recordLevel,
  recordPractice,
  recordSpeedRun,
  speedAvailable,
  unlockWorld,
} from '../src/engine/progress';
import { createRng } from '../src/engine/rng';
import { GAME_CATALOG } from '../src/games/catalog';
import { buildCrosswordRound } from '../src/games/crossword/build';
import { wordCells } from '../src/games/crossword/generate';
import { buildIdiomRound, idiomsConflict } from '../src/games/idiomMatch/build';
import { createResolver, sourceId } from '../src/games/items';
import { buildPlacement, drawBoss, PLACEMENT_MIX, placementUnlocks } from '../src/games/session';
import { buildSpeedQuestions, comboFor, emptyTally, tallyAnswer } from '../src/games/speedChallenge/speed';
import { buildTypeRound } from '../src/games/typeSynonym/build';
import { isIdiom, type LevelItem } from '../src/games/types';
import { createPlanner } from '../src/engine/level-run';
import { ctxFor, envFor, pairs, sessionFor } from './helpers';

const env = envFor();
const layout = buildLayout(content);
const resolver = createResolver(content);
const w1 = layout.worlds[0]!;
const w4 = layout.worlds[3]!;
const difficulty = { tier: 3 as const, options: 4 as const };
const worldIds = (w: typeof w1) => w.stations.flatMap((s) => s.levels.flatMap((l) => l.itemIds));
const idioms = (): LevelItem[] => content.idioms.map((i) => resolver.byId(i.id)!);
const idiom = (text: string) => content.idioms.find((i) => i.idiom === text)!;

describe('World 4 levels', () => {
  it('play idiomMatch through all three stages in the idiom station', () => {
    const session = sessionFor(w4.stations[0]!.levels[0]!);
    expect(session.run.rounds.map((r) => [r.gameId, r.stage])).toEqual([
      ['idiomMatch', 'recognition'],
      ['idiomMatch', 'discrimination'],
      ['idiomMatch', 'production'],
    ]);
  });

  it('offer typing and the crossword for pair reviews', () => {
    const items = pairs(sessionFor(w1.stations[1]!.levels[0]!).items);
    const planner = createPlanner(4, GAME_CATALOG, ctxFor());
    expect(planner.playable('typeSynonym', items)).toHaveLength(items.length);
    expect(planner.playable('crossword', items).length).toBeGreaterThanOrEqual(3);
    expect(createPlanner(3, GAME_CATALOG, ctxFor()).playable('typeSynonym', items)).toEqual([]);
  });
});

describe('idiomMatch', () => {
  it('keeps idioms with overlapping meanings apart', () => {
    expect(idiomsConflict(env, idiom('עלה בידו'), idiom('עשה חיל'))).toBe(true);
    expect(idiomsConflict(env, idiom('קשה עורף'), idiom('עמד על שלו'))).toBe(true);
    expect(idiomsConflict(env, idiom('קשה עורף'), idiom('נתן כתף'))).toBe(false);
  });

  it('builds each mode with one right answer and no conflicting options', () => {
    for (const stage of ['recognition', 'discrimination', 'production'] as const) {
      const round = buildIdiomRound(env, idioms(), difficulty, createRng(stage), stage);
      for (const q of round.questions) {
        expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(`${q.fill.before}${q.fill.answer}${q.fill.after}`).toBe(q.item.idiom.example);
        if (round.mode !== 'fill') {
          const pick =
            round.mode === 'meaning' ? (i: typeof q.item.idiom) => i.meaning : (i: typeof q.item.idiom) => i.idiom;
          for (const o of q.options.filter((x) => x !== q.answer)) {
            const other = content.idioms.find((i) => pick(i) === o)!;
            expect(idiomsConflict(env, q.item.idiom, other), `${q.item.idiom.idiom} / ${other.idiom}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('typeSynonym and crossword builders', () => {
  it('accepts every direct synonym, including also-synonyms pairs', () => {
    const tense = content.entries.find((e) => e.headword === 'מתוח')!;
    const round = buildTypeRound(
      env,
      [{ kind: 'pair', key: 'e004|דרוך', entry: tense, synonym: 'דרוך' }],
      difficulty,
      createRng(1),
    );
    expect(round.questions[0]!.accepted).toEqual(expect.arrayContaining(['דרוך', 'לחוץ', 'עצבני', 'חרד', 'מוטרד']));
  });

  it('builds a crossword whose words are the items synonyms, with tiles for every letter', () => {
    for (const level of w1.stations.flatMap((s) => s.levels).slice(0, 8)) {
      const items = pairs(sessionFor(level).items);
      const round = buildCrosswordRound(env, items, difficulty, createRng(level.id));
      expect(round.puzzle.words.length).toBeGreaterThanOrEqual(2);
      for (const w of round.puzzle.words) {
        const item = round.items[w.itemKey]!;
        expect(item.entry.synonyms).toContain(w.answer);
        expect(w.clue).toContain(item.entry.headword);
        const tiles = [...round.tiles[w.itemKey]!];
        for (const ch of w.answer) tiles.splice(tiles.indexOf(ch), 1);
        expect(tiles).toHaveLength(3);
        expect(wordCells(w)).toHaveLength(w.answer.length);
      }
    }
  });
});

describe('boss levels', () => {
  const due = (box: 1 | 2 | 3, lapses = 0) => ({ box, due: '2026-10-01', seen: 3, lapses, lastSeen: '2026-10-01' });

  it('draw 15 items from the world, mostly the weakest, one per source', () => {
    const weak: LeitnerState = {};
    for (const id of worldIds(w1).slice(0, 12)) {
      const e = content.entries.find((x) => x.id === id)!;
      weak[`${id}|${e.synonyms[0]}`] = due(1, 2);
    }
    weak['b500|x'] = due(1);
    weak['scale01'] = due(1, 5);
    const items = drawBoss(15, weak, worldIds(w1), resolver, createRng(1));
    expect(items).toHaveLength(15);
    expect(new Set(items.map(sourceId)).size).toBe(15);
    expect(items.every((i) => worldIds(w1).includes(sourceId(i)))).toBe(true);
    const weakSources = new Set(worldIds(w1).slice(0, 12));
    expect(items.filter((i) => weakSources.has(sourceId(i))).length).toBeGreaterThanOrEqual(10);
  });

  it('ask each item once, one round per item kind, with no re-inserted rounds', () => {
    const items = drawBoss(15, {}, [...worldIds(layout.worlds[2]!), ...worldIds(w4)], resolver, createRng(2));
    const rounds = planSinglePass(4, GAME_CATALOG, items, ctxFor());
    expect(rounds.flatMap((r) => r.items.map((i) => i.key)).sort()).toEqual(items.map((i) => i.key).sort());
    expect(rounds.every((r) => r.stage === 'recognition')).toBe(true);
    const session = sessionFor(w1.boss, {}, 'b', { reviewFallback: worldIds(w1) });
    expect(session.items).toHaveLength(15);
    expect(session.learn).toEqual([]);
    expect(session.run.singlePass).toBe(true);
    const planner = createPlanner(1, GAME_CATALOG, ctxFor());
    const after = finishRound(
      session.run,
      { answers: session.items.map((i) => ({ itemKey: i.key, outcome: 'wrong' })) },
      planner,
    );
    expect(after.rounds).toHaveLength(session.run.rounds.length);
    expect(after.reinserted).toEqual([]);
  });

  it('a pass marks the boss done and opens the next world; a fail keeps practice and takes nothing away', () => {
    const p = {
      ...initialProgress(),
      xp: 100,
      levels: { 'w1-emotions-1': { stars: 3 as const, bestAccuracy: 1, completedAt: 'x' } },
    };
    const passed = unlockWorld(
      recordLevel(p, { levelId: w1.boss.id, stars: 3, accuracy: 0.93, xp: 50, leitner: {}, completedAt: 'x' }),
      2,
    );
    expect(isLevelDone(passed, w1.boss.id)).toBe(true);
    expect(passed.unlockedWorlds).toEqual([1, 2]);
    const failed = recordPractice(p, { xp: 20, leitner: { a: due(1) } });
    expect(isLevelDone(failed, w1.boss.id)).toBe(false);
    expect(failed.levels).toEqual(p.levels);
    expect(failed.xp).toBe(120);
    expect(unlockWorld(unlockWorld(p, 5), 2).unlockedWorlds).toEqual([1, 2]);
    expect(worldLevels(w1).at(-1)).toEqual(w1.boss);
  });
});

describe('placement', () => {
  it('mixes 10 easy, 6 medium and 4 hard words', () => {
    const { items, easyKeys } = buildPlacement(content.entries, 'p');
    expect(items).toHaveLength(20);
    const byDifficulty = pairs(items).reduce<Record<number, number>>(
      (m, i) => ({ ...m, [i.entry.difficulty]: (m[i.entry.difficulty] ?? 0) + 1 }),
      {},
    );
    expect(byDifficulty).toEqual({ 1: PLACEMENT_MIX.easy, 2: PLACEMENT_MIX.medium, 3: PLACEMENT_MIX.hard });
    expect(easyKeys).toHaveLength(10);
    expect(buildPlacement(content.entries, 'p')).toEqual(buildPlacement(content.entries, 'p'));
  });

  it('opens World 2 at 85% or more on the easy words only', () => {
    const { items, easyKeys } = buildPlacement(content.entries, 'q');
    const answer = (wrongEasy: number) => {
      let wrong = 0;
      return items.map((i) => {
        const easy = easyKeys.includes(i.key);
        const out = easy && wrong < wrongEasy ? 'wrong' : easy ? 'correct' : 'wrong';
        if (easy && out === 'wrong') wrong += 1;
        return { itemKey: i.key, outcome: out };
      });
    };
    expect(placementUnlocks(answer(1), easyKeys)).toBe(true);
    expect(placementUnlocks(answer(2), easyKeys)).toBe(false);
  });
});

describe('speed challenge', () => {
  it('scores 10 x combo, the combo growing every two in a row up to 5x, and resets on a miss', () => {
    expect([0, 1, 2, 3, 4, 8, 20].map(comboFor)).toEqual([1, 1, 2, 2, 3, 5, 5]);
    let t = emptyTally;
    for (let i = 0; i < 4; i++) t = tallyAnswer(t, true);
    expect(t).toEqual({ score: 10 + 10 + 20 + 20, correct: 4, answered: 4, streak: 4 });
    t = tallyAnswer(t, false);
    expect(t.streak).toBe(0);
    expect(tallyAnswer(t, true).score).toBe(70);
  });

  it('builds plenty of questions with one right option each', () => {
    const qs = buildSpeedQuestions(env, content.entries, 's');
    expect(qs.length).toBeGreaterThanOrEqual(60);
    for (const q of qs.slice(0, 30)) expect(q.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it('is offered once World 4 is open and speed mode is on, and keeps the best run', () => {
    const p = initialProgress();
    expect(speedAvailable(p)).toBe(false);
    expect(speedAvailable(unlockWorld(p, 4))).toBe(true);
    expect(speedAvailable({ ...unlockWorld(p, 4), settings: { ...p.settings, speedMode: false } })).toBe(false);
    const best = recordSpeedRun(recordSpeedRun(p, { score: 120, correct: 9, at: 'a' }), {
      score: 80,
      correct: 7,
      at: 'b',
    });
    expect(best.speedBest).toEqual({ score: 120, correct: 9, at: 'a' });
  });
});

it('idiom resolver sanity', () => {
  expect(idioms().every(isIdiom)).toBe(true);
});
