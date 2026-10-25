import { describe, expect, it } from 'vitest';
import { buildContent, content, sources } from '../src/content';
import { createDisplayWord } from '../src/content/display';
import type { Content } from '../src/content/types';
import { buildSynonymGraph } from '../src/engine/graph';
import { buildLayout } from '../src/engine/layout';
import { planStages } from '../src/engine/level-run';
import { buildSynonymLinks } from '../src/engine/links';
import { createRng } from '../src/engine/rng';
import { buildOddRound, canHostOdd, isIntruder } from '../src/games/oddOneOut/build';
import { GAME_CATALOG } from '../src/games/registry';
import { buildLevelSession } from '../src/games/session';
import { buildSwapRound, fitsSentence, splitAtHeadword } from '../src/games/swapWord/build';
import type { GameEnv } from '../src/games/types';
import { buildWordSearchRound } from '../src/games/wordSearch/build';
import { generateWordSearch, gridLetters, matchSelection, selectionCells } from '../src/games/wordSearch/generate';

const envFor = (c: Content): GameEnv => ({
  content: c,
  graph: buildSynonymGraph(c),
  links: buildSynonymLinks(c),
  pool: c.entries,
  decisions: {},
  displayWord: createDisplayWord(c),
});
const env = envFor(content);
const layout = buildLayout(content);
const world2Sessions = layout.worlds[1]!.stations.flatMap((s) => s.levels).map((l) =>
  buildLevelSession(l, content, {}, 'w2'),
);
const difficulty = { tier: 2 as const, options: 4 as const };

describe('World 2 level planning', () => {
  it('chooses each stage from World 1 and World 2 games', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      for (const g of planStages(2, GAME_CATALOG, world2Sessions[0]!.items, createRng(seed), content)) seen.add(g);
    }
    expect(seen).toEqual(new Set(['pickSynonym', 'wordSearch', 'dragPairs', 'oddOneOut', 'memory']));
  });

  it('leaves swapWord out until sentences are reviewed, then includes it', () => {
    const reviewed = buildContent({
      ...sources,
      sentences: {
        ...sources.sentences,
        sentences: sources.sentences.sentences.map((s) => ({ ...s, reviewed: true })),
      },
    });
    const items = buildLevelSession(layout.worlds[1]!.stations[0]!.levels[0]!, reviewed, {}, 'x').items;
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++)
      for (const g of planStages(2, GAME_CATALOG, items, createRng(seed), reviewed)) seen.add(g);
    expect(seen.has('swapWord')).toBe(true);
    for (let seed = 0; seed < 40; seed++)
      expect(planStages(2, GAME_CATALOG, items, createRng(seed), content)).not.toContain('swapWord');
  });

  it('keeps World 1 levels on World 1 games', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(planStages(1, GAME_CATALOG, world2Sessions[0]!.items, createRng(seed), content)).toEqual([
        'pickSynonym',
        'dragPairs',
        'memory',
      ]);
    }
  });
});

describe('oddOneOut', () => {
  it('builds 4 bubbles: three pairwise synonyms and one intruder linked to none of them', () => {
    for (const s of world2Sessions) {
      const round = buildOddRound(env, s.items, difficulty, createRng(s.items[0]!.key));
      expect(round.questions).toHaveLength(s.items.filter(canHostOdd).length);
      for (const q of round.questions) {
        expect(q.bubbles).toHaveLength(4);
        const intruders = q.bubbles.filter((b) => b.intruder);
        expect(intruders).toHaveLength(1);
        const friends = q.bubbles.filter((b) => !b.intruder);
        for (const a of friends)
          for (const b of friends) if (a !== b) expect(env.links.areLinked(a.word, b.word)).toBe(true);
        expect(q.bubbles.filter((b) => isIntruder(env, q, b.word)).map((b) => b.word)).toEqual([intruders[0]!.word]);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const items = world2Sessions[2]!.items;
    expect(buildOddRound(env, items, difficulty, createRng(5))).toEqual(
      buildOddRound(env, items, difficulty, createRng(5)),
    );
  });
});

describe('swapWord', () => {
  it('splits a sentence around its headword, keeping a prefix letter outside the slot', () => {
    expect(splitAtHeadword('הוא רעד מפחד כשהאורות כבו.', 'פחד')).toEqual({
      before: 'הוא רעד ',
      prefix: 'מ',
      headword: 'פחד',
      after: ' כשהאורות כבו.',
    });
    expect(splitAtHeadword('הקבוצה שלנו ניצחה.', 'קבוצה')).toEqual({
      before: '',
      prefix: 'ה',
      headword: 'קבוצה',
      after: ' שלנו ניצחה.',
    });
    expect(splitAtHeadword('אני אסיר תודה לך על העזרה.', 'אסיר תודה')?.headword).toBe('אסיר תודה');
    expect(splitAtHeadword('אין כאן כלום', 'בית')).toBeNull();
  });

  it('finds the headword in every generated sentence', () => {
    for (const s of content.sentences) {
      const e = content.entries.find((x) => x.id === s.entryId)!;
      expect(splitAtHeadword(s.text, e.headword), s.id).not.toBeNull();
    }
  });

  it('uses reviewed sentences only, and offers exactly one word that fits', () => {
    const items = world2Sessions[0]!.items;
    expect(buildSwapRound(env, items, difficulty, createRng(1)).questions).toEqual([]);
    const reviewed = buildContent({
      ...sources,
      sentences: {
        ...sources.sentences,
        sentences: sources.sentences.sentences.map((s) => ({ ...s, reviewed: true })),
      },
    });
    const round = buildSwapRound(envFor(reviewed), items, difficulty, createRng(1));
    expect(round.questions.length).toBeGreaterThan(0);
    for (const q of round.questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => fitsSentence(q, o.word))).toHaveLength(1);
      expect(q.before + q.prefix + q.headword + q.after).toBe(q.sentence.text);
    }
  });
});

describe('wordSearch generator', () => {
  it('places every word in bounds, right-to-left or top-down only, without conflicts, deterministically', () => {
    for (const s of world2Sessions) {
      for (const seed of [1, 2, 3]) {
        const round = buildWordSearchRound(env, s.items, difficulty, createRng(`${s.items[0]!.key}:${seed}`));
        const { grid } = round;
        expect(grid.words.length).toBeGreaterThanOrEqual(8);
        expect(grid.words.length).toBeLessThanOrEqual(10);
        expect(grid.rows).toHaveLength(10);
        for (const row of grid.rows) {
          expect(row).toHaveLength(10);
          for (const ch of row) expect(ch).toMatch(/^[א-ת]$/);
        }
        for (const w of grid.words) {
          expect(['rtl', 'down']).toContain(w.direction);
          expect(w.cells.map((c) => grid.rows[c.row]![c.col]).join('')).toBe(w.letters);
          for (const c of w.cells) expect(c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10).toBe(true);
          expect(matchSelection(grid, w.cells, new Set())?.itemKey).toBe(w.itemKey);
        }
        expect(buildWordSearchRound(env, s.items, difficulty, createRng(`${s.items[0]!.key}:${seed}`))).toEqual(round);
      }
    }
  });

  it('runs multi-word phrases together in the grid', () => {
    expect(gridLetters('שקט נפשי')).toBe('שקטנפשי');
    const grid = generateWordSearch([{ word: 'שקט נפשי', itemKey: 'a' }], createRng(1));
    expect(grid.words[0]!.letters).toBe('שקטנפשי');
  });

  it('accepts selections only right-to-left along a row or top-down along a column', () => {
    expect(selectionCells({ row: 2, col: 1 }, { row: 2, col: 4 })).toHaveLength(4);
    expect(selectionCells({ row: 1, col: 3 }, { row: 5, col: 3 })).toHaveLength(5);
    expect(selectionCells({ row: 2, col: 4 }, { row: 2, col: 1 })).toBeNull();
    expect(selectionCells({ row: 5, col: 3 }, { row: 1, col: 3 })).toBeNull();
    expect(selectionCells({ row: 0, col: 0 }, { row: 3, col: 3 })).toBeNull();
  });

  it('throws on a word longer than the grid', () => {
    expect(() => generateWordSearch([{ word: 'אאאאאאאאאאא', itemKey: 'x' }], createRng(1))).toThrow();
  });
});
