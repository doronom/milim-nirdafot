import { describe, expect, it } from 'vitest';
import { content, onlyReviewed } from '../src/content';
import { normalizeWord } from '../src/content/text';
import { chooseTier, pairKey, pickDistractors, rankNearMisses, trapKeys, type Tier } from '../src/engine/distractors';
import { buildSynonymGraph } from '../src/engine/graph';
import { createRng } from '../src/engine/rng';

const graph = buildSynonymGraph(content);
const pool = content.entries;
const byKey = new Map<string, typeof pool>();
for (const e of pool) {
  for (const w of [e.headword, ...e.synonyms]) {
    const k = normalizeWord(w);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
}
const entry = (id: string) => content.entries.find((e) => e.id === id)!;

describe('pickDistractors', () => {
  it('never offers a word from the target group, for every entry, tier and several seeds', () => {
    for (const target of content.entries) {
      const blocked = graph.groupKeys(graph.headwordNode(target));
      for (const tier of [1, 2, 3] as Tier[]) {
        for (const seed of [1, 2, 3]) {
          const picked = pickDistractors(graph, { target, tier, count: 4, rng: createRng(seed), pool });
          expect(picked, `${target.id} t${tier}`).toHaveLength(4);
          for (const d of picked) expect(blocked.has(normalizeWord(d.word)), `${target.id}: ${d.word}`).toBe(false);
          expect(new Set(picked.map((d) => normalizeWord(d.word))).size).toBe(4);
        }
      }
    }
  });

  it('tier 1 comes from other categories', () => {
    const target = entry('b031'); // גדול
    const picked = pickDistractors(graph, { target, tier: 1, count: 5, rng: createRng(7), pool });
    for (const d of picked) {
      expect(d.tier).toBe(1);
      expect(byKey.get(normalizeWord(d.word))!.some((e) => e.categoryId === target.categoryId)).toBe(false);
    }
  });

  it('tier 2 matches category and part of speech', () => {
    const target = entry('b151'); // הלך
    const picked = pickDistractors(graph, { target, tier: 2, count: 5, rng: createRng(7), pool });
    for (const d of picked) {
      expect(d.tier).toBe(2);
      expect(byKey.get(normalizeWord(d.word))!.some((e) => e.categoryId === target.categoryId && e.pos === 'verb')).toBe(true);
    }
  });

  it('tier 3 picks near-misses of similar length and word count', () => {
    const target = entry('b118'); // טעים
    const answer = 'משובח';
    const picked = pickDistractors(graph, { target, answer, tier: 3, count: 3, rng: createRng(11), pool });
    const near = picked.filter((d) => d.tier === 3);
    expect(near.length).toBeGreaterThan(0);
    for (const d of near) {
      expect(Math.abs(normalizeWord(d.word).replace(/ /g, '').length - answer.length)).toBeLessThanOrEqual(1);
      expect(d.word.includes(' ')).toBe(false);
    }
  });

  it('tier 3 skips groups two hops away until the trap is confirmed', () => {
    const target = entry('e015'); // חלק (משטח); שטוח is two hops away through שטוח -> חלק
    const offered = (decisions = {}) => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 40; seed++) {
        for (const d of pickDistractors(graph, { target, answer: 'מלוטש', tier: 3, count: 4, rng: createRng(seed), pool, decisions })) seen.add(d.word);
      }
      return seen;
    };
    expect(offered().has('שטוח')).toBe(false);
    expect(rankNearMisses(graph, target, pool).find((n) => n.word === 'שטוח')?.status).toBe('two-hop');
    const confirmedTraps = trapKeys([{ targetId: 'e015', distractor: 'שטוח' }]);
    expect(rankNearMisses(graph, target, pool, { confirmedTraps }).find((n) => n.word === 'שטוח')?.status).toBe('confirmed-trap');
    expect(offered({ confirmedTraps }).has('שטוח')).toBe(true);
  });

  it('never offers a pair reported as also correct while it is pending', () => {
    const target = entry('e004'); // מתוח
    const pending = new Set([pairKey('e004', 'חושש')]);
    for (let seed = 0; seed < 40; seed++) {
      const picked = pickDistractors(graph, { target, tier: 3, count: 4, rng: createRng(seed), pool, decisions: { pending } });
      expect(picked.some((d) => d.word === 'חושש')).toBe(false);
    }
  });

  it('never offers חרד or מוטרד for מתוח (linked by also-synonyms.json)', () => {
    const target = entry('e004');
    for (let seed = 0; seed < 40; seed++) {
      for (const tier of [1, 2, 3] as Tier[]) {
        const words = pickDistractors(graph, { target, tier, count: 4, rng: createRng(seed), pool }).map((d) => d.word);
        expect(words).not.toContain('חרד');
        expect(words).not.toContain('מוטרד');
      }
    }
  });

  it('is deterministic for a seed and independent of pool order', () => {
    const target = entry('b080');
    const a = pickDistractors(graph, { target, tier: 2, count: 4, rng: createRng('level-1:round-2'), pool });
    const b = pickDistractors(graph, { target, tier: 2, count: 4, rng: createRng('level-1:round-2'), pool: [...pool].reverse() });
    expect(a).toEqual(b);
  });

  it('falls back to easier tiers when the requested one runs short', () => {
    const target = entry('b001');
    const tiny = content.entries.filter((e) => e.categoryId === 'emotions').slice(0, 3).concat(entry('b300'));
    const picked = pickDistractors(graph, { target, tier: 3, count: 4, rng: createRng(3), pool: tiny });
    expect(picked).toHaveLength(4);
    expect(picked.some((d) => d.tier < 3)).toBe(true);
  });

  it('blocks synonyms known only from unreviewed entries when drawing from a reviewed-only pool', () => {
    // מלא and שלם link through no extra entry, but צפוף (extra) joins צר and גדוש: graph from all content keeps that.
    const reviewedPool = onlyReviewed(content).entries;
    const target = entry('b057'); // צר
    const blocked = graph.groupKeys(graph.headwordNode(target));
    expect(blocked.has('גדוש')).toBe(true);
    for (let seed = 0; seed < 30; seed++) {
      for (const d of pickDistractors(graph, { target, tier: 2, count: 4, rng: createRng(seed), pool: reviewedPool })) {
        expect(blocked.has(normalizeWord(d.word))).toBe(false);
      }
    }
  });
});

describe('chooseTier', () => {
  it('starts from the world and nudges by mastery', () => {
    expect(chooseTier({ world: 1 })).toBe(1);
    expect(chooseTier({ world: 2 })).toBe(2);
    expect(chooseTier({ world: 4 })).toBe(3);
    expect(chooseTier({ world: 1, box: 5 })).toBe(2);
    expect(chooseTier({ world: 2, box: 1 })).toBe(1);
    expect(chooseTier({ world: 1, box: 1 })).toBe(1);
    expect(chooseTier({ world: 3, box: 4 })).toBe(3);
  });
});
