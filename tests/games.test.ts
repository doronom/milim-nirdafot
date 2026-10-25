import { describe, expect, it } from 'vitest';
import { entryPool } from '../src/app/data';
import { WORLDS } from '../src/config/game';
import { content } from '../src/content';
import { normalizeWord } from '../src/content/text';
import type { Difficulty } from '../src/engine/adaptive';
import { buildLayout } from '../src/engine/layout';
import { createRng } from '../src/engine/rng';
import { buildDragRound, dropMatches, pairsPerBoard } from '../src/games/dragPairs/build';
import { buildMemoryRound, cardsMatch, memoryPairs } from '../src/games/memory/build';
import { buildPickRound } from '../src/games/pickSynonym/build';
import { createGames, GAME_CATALOG } from '../src/games/registry';
import { envFor, pairs, sessionFor } from './helpers';

const env = envFor();
const layout = buildLayout(content);
const world1Levels = layout.worlds[0]!.stations.flatMap((s) => s.levels);
const sessions = world1Levels.map((l) => {
  const s = sessionFor(l, {}, 'x');
  return { ...s, items: pairs(s.items) };
});
const difficulties: Difficulty[] = [
  { tier: 1, options: 3 },
  { tier: 2, options: 4 },
  { tier: 3, options: 5 },
];

describe('game registry', () => {
  it('matches the catalog used for planning, and each game unlocks in its world', () => {
    const games = createGames(env);
    expect(new Set(games.keys())).toEqual(new Set(GAME_CATALOG.map((g) => g.id)));
    for (const info of GAME_CATALOG) {
      const g = games.get(info.id)!;
      expect([g.stages, g.minItems]).toEqual([info.stages, info.minItems]);
      expect(WORLDS.find((w) => w.newGames.includes(g.id))?.id).toBe(g.minWorld);
    }
  });

  it('builds every round deterministically for a seed', () => {
    const games = createGames(env);
    const items = sessions[3]!.items;
    for (const g of games.values()) {
      expect(g.buildRound(items, difficulties[1]!, createRng('s'), g.stages[0]!)).toEqual(
        g.buildRound(items, difficulties[1]!, createRng('s'), g.stages[0]!),
      );
    }
  });
});

describe('pickSynonym', () => {
  it('has exactly one directly linked option per question, at every difficulty, for all World 1 levels', () => {
    // World 1 draws distractors from its own (smaller) word pool; it must still fill 5 options.
    const worldOneEnv = { ...env, pool: entryPool(false, 1) };
    for (const s of sessions) {
      for (const d of difficulties) {
        const round = buildPickRound(worldOneEnv, s.items, d, createRng(`${s.items[0]!.key}:${d.tier}`));
        expect(round.questions).toHaveLength(s.items.length);
        for (const q of round.questions) {
          expect(q.options).toHaveLength(d.options);
          const linked = q.options.filter((o) => env.links.areLinked(q.prompt, o.word));
          expect(
            linked.map((o) => o.word),
            q.prompt,
          ).toEqual([q.item.synonym]);
          expect(q.options.filter((o) => o.correct).map((o) => o.word)).toEqual([q.item.synonym]);
          expect(new Set(q.options.map((o) => normalizeWord(o.word))).size).toBe(d.options);
        }
      }
    }
  });
});

describe('dragPairs', () => {
  it('places every item once on boards of 4-5 pairs with no cross-links', () => {
    for (const s of sessions) {
      for (const d of difficulties) {
        const round = buildDragRound(env, s.items, d, createRng(s.items[0]!.key));
        const placed = round.boards.flatMap((b) => b.chips.map((c) => c.key));
        expect(new Set(placed)).toEqual(new Set(s.items.map((i) => i.key)));
        for (const board of round.boards) {
          expect(board.chips.length).toBeLessThanOrEqual(pairsPerBoard(d));
          for (const chip of board.chips) {
            const accepting = board.targets.filter((t) => dropMatches(env, chip, t));
            expect(accepting.map((t) => t.key)).toEqual([chip.key]);
          }
        }
      }
    }
  });
});

describe('memory', () => {
  it('uses 6 or 8 pairs where enough items exist, and only intended pairs match', () => {
    expect(memoryPairs({ tier: 1, options: 3 }, 8)).toBe(6);
    expect(memoryPairs({ tier: 2, options: 4 }, 8)).toBe(8);
    expect(memoryPairs({ tier: 3, options: 5 }, 7)).toBe(6);
    expect(memoryPairs({ tier: 1, options: 3 }, 4)).toBe(4);
    for (const s of sessions) {
      for (const d of difficulties) {
        const round = buildMemoryRound(env, s.items, d, createRng(s.items[0]!.key));
        expect(round.cards).toHaveLength(round.items.length * 2);
        expect(round.items.length).toBeGreaterThanOrEqual(Math.min(5, s.items.length));
        for (const a of round.cards) {
          for (const b of round.cards) {
            if (a.id === b.id) continue;
            expect(cardsMatch(env, a, b), `${a.word}~${b.word}`).toBe(a.item.key === b.item.key);
          }
        }
      }
    }
  });
});
