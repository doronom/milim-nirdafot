import { normalizeWord } from '../content/text';
import type { Entry, Pos } from '../content/types';
import type { SynonymGraph } from './graph';
import type { Rng } from './rng';

/**
 * 1: a word from another category (easy).
 * 2: same category and part of speech.
 * 3: near-miss: same category and part of speech, similar shape, ideally from a group that shares a spelling with the target's.
 */
export type Tier = 1 | 2 | 3;

export interface Distractor {
  word: string;
  nodeId: string;
  /** The tier the word actually came from; lower than requested when the pool ran short. */
  tier: Tier;
}

export interface DistractorRequest {
  target: Entry;
  /** The correct option shown next to the distractors; tier 3 matches its length. Defaults to the first synonym. */
  answer?: string;
  tier: Tier;
  count: number;
  rng: Rng;
  /**
   * Entries the distractors may be drawn from, e.g. the reviewed-only subset. The graph itself should be built from
   * all content, so a synonym known only through an unreviewed entry still blocks a wrong option.
   */
  pool: readonly Entry[];
}

interface Candidate {
  key: string;
  word: string;
  nodeId: string;
  categoryIds: Set<string>;
  pos: Set<Pos>;
}

const letters = (w: string) => normalizeWord(w).replace(/[\s־]/g, '');
const wordCount = (w: string) => normalizeWord(w).split(/[\s־]+/).length;

/** Dice coefficient over letter multisets: a cheap stand-in for "looks similar". */
function letterSimilarity(a: string, b: string): number {
  const la = [...letters(a)];
  const counts = new Map<string, number>();
  for (const ch of letters(b)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let shared = 0;
  for (const ch of la) {
    const n = counts.get(ch) ?? 0;
    if (n > 0) {
      shared += 1;
      counts.set(ch, n - 1);
    }
  }
  const total = la.length + letters(b).length;
  return total === 0 ? 0 : (2 * shared) / total;
}

const candidateCache = new WeakMap<SynonymGraph, WeakMap<readonly Entry[], Candidate[]>>();

/** Every spelling in the pool once, sorted by key so the rng sees the same order regardless of pool order. Cached per pool. */
function collectCandidates(graph: SynonymGraph, pool: readonly Entry[]): Candidate[] {
  let perGraph = candidateCache.get(graph);
  if (!perGraph) {
    perGraph = new WeakMap();
    candidateCache.set(graph, perGraph);
  }
  const cached = perGraph.get(pool);
  if (cached) return cached;
  const byKey = new Map<string, Candidate>();
  for (const e of pool) {
    for (const w of [e.headword, ...e.synonyms]) {
      const key = normalizeWord(w);
      let c = byKey.get(key);
      if (!c) {
        c = { key, word: w, nodeId: graph.resolve(e.id, w), categoryIds: new Set(), pos: new Set() };
        byKey.set(key, c);
      }
      c.categoryIds.add(e.categoryId);
      c.pos.add(e.pos);
    }
  }
  const list = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  perGraph.set(pool, list);
  return list;
}

/**
 * Picks `count` wrong options for `target`. Hard rule: no distractor shares a spelling with any word in the target's
 * connected synonym group. When the requested tier runs short it falls back to easier tiers, never breaking that rule.
 */
export function pickDistractors(graph: SynonymGraph, req: DistractorRequest): Distractor[] {
  const { target, tier, count, rng, pool } = req;
  const answer = req.answer ?? target.synonyms[0] ?? target.headword;
  const targetNode = graph.headwordNode(target);
  const blocked = new Set(graph.groupKeys(targetNode));
  blocked.add(normalizeWord(target.headword));
  blocked.add(normalizeWord(answer));

  // Groups that share a spelling with the target's group (homograph neighbours) make the best near-misses.
  const targetGroup = graph.nodes.get(targetNode)?.group;
  const relatedGroups = new Set<number>();
  for (const node of graph.nodes.values()) {
    if (node.group !== targetGroup && blocked.has(node.key)) relatedGroups.add(node.group);
  }

  const candidates = collectCandidates(graph, pool).filter((c) => !blocked.has(c.key));

  const sameCategory = (c: Candidate) => c.categoryIds.has(target.categoryId);
  const tier1 = candidates.filter((c) => !sameCategory(c));
  const tier2 = candidates.filter((c) => sameCategory(c) && c.pos.has(target.pos));
  const answerLength = letters(answer).length;
  const tier3 = tier2
    .filter((c) => wordCount(c.word) === wordCount(answer) && Math.abs(letters(c.word).length - answerLength) <= 1)
    .map((c) => ({
      c,
      score:
        letterSimilarity(c.word, answer) + (relatedGroups.has(graph.nodes.get(c.nodeId)?.group ?? -1) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    // Keep a shortlist of the closest so repeated rounds still vary.
    .slice(0, Math.max(count * 2, 6))
    .map(({ c }) => c);

  const picked: Distractor[] = [];
  const used = new Set<string>();
  const take = (list: Candidate[], from: Tier) => {
    for (const c of rng.shuffle(list)) {
      if (picked.length >= count) return;
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push({ word: c.word, nodeId: c.nodeId, tier: from });
    }
  };
  if (tier >= 3) take(tier3, 3);
  if (tier >= 2) take(tier2, 2);
  take(tier1, 1);
  return picked;
}

export interface TierContext {
  world: 1 | 2 | 3 | 4;
  /** Leitner box (1-5) of the item being asked, when known. */
  box?: number;
}

/** Base tier from the world, nudged by mastery: well-known items get harder distractors, shaky ones easier. */
export function chooseTier({ world, box }: TierContext): Tier {
  let tier = Math.min(world, 3);
  if (box !== undefined && box >= 4) tier += 1;
  if (box !== undefined && box <= 1) tier -= 1;
  return Math.max(1, Math.min(3, tier)) as Tier;
}
