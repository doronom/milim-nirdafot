import { normalizeWord } from '../content/text';
import type { Entry, NotSynonymPair, Pos } from '../content/types';
import type { SynonymGraph } from './graph';
import type { Rng } from './rng';

/**
 * 1: a word from another category (easy).
 * 2: same category and part of speech (also skipping unconfirmed two-hop groups).
 * 3: near-miss: same category and part of speech, similar shape, never from a group two hops away unless confirmed.
 */
export type Tier = 1 | 2 | 3;

export interface Distractor {
  word: string;
  nodeId: string;
  /** The tier the word actually came from; lower than requested when the pool ran short. */
  tier: Tier;
}

/** Pair decisions that change what may be offered. Keys come from `pairKey`. */
export interface PairDecisions {
  /** Confirmed fair traps (not-synonyms.json): allowed in tier 3 even two hops away. */
  confirmedTraps?: ReadonlySet<string>;
  /** Reported in game as "also correct" and not reviewed yet: never offered for that target. */
  pending?: ReadonlySet<string>;
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
  decisions?: PairDecisions;
}

interface Candidate {
  key: string;
  word: string;
  nodeId: string;
  categoryIds: Set<string>;
  pos: Set<Pos>;
}

export type NearMissStatus = 'eligible' | 'confirmed-trap' | 'two-hop' | 'pending';

export interface NearMiss {
  word: string;
  nodeId: string;
  score: number;
  status: NearMissStatus;
}

/** Identifies a (target entry, offered spelling) pair across decision files, the review queue and reports. */
export const pairKey = (targetId: string, word: string): string => `${targetId}|${normalizeWord(word)}`;

export const trapKeys = (pairs: readonly NotSynonymPair[]): Set<string> =>
  new Set(pairs.map((p) => pairKey(p.targetId, p.distractor)));

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

interface Prepared {
  answer: string;
  /** Same-category, same-pos candidates outside the target group and not pending. */
  tier2: Candidate[];
  tier1: Candidate[];
  twoHop: Set<number>;
}

function prepare(
  graph: SynonymGraph,
  target: Entry,
  answerIn: string | undefined,
  pool: readonly Entry[],
  pending?: ReadonlySet<string>,
): Prepared {
  const answer = answerIn ?? target.synonyms[0] ?? target.headword;
  const targetNode = graph.headwordNode(target);
  const blocked = new Set(graph.groupKeys(targetNode));
  blocked.add(normalizeWord(target.headword));
  blocked.add(normalizeWord(answer));
  const candidates = collectCandidates(graph, pool).filter(
    (c) => !blocked.has(c.key) && !pending?.has(pairKey(target.id, c.key)),
  );
  const sameCategory = (c: Candidate) => c.categoryIds.has(target.categoryId);
  return {
    answer,
    tier1: candidates.filter((c) => !sameCategory(c)),
    tier2: candidates.filter((c) => sameCategory(c) && c.pos.has(target.pos)),
    twoHop: graph.twoHopGroups(targetNode),
  };
}

/** Tier 3 shape filter and score, with the review status of each candidate. Sorted best first. */
function scoreNearMisses(
  graph: SynonymGraph,
  target: Entry,
  p: Prepared,
  traps?: ReadonlySet<string>,
): (NearMiss & { c: Candidate })[] {
  const answerLength = letters(p.answer).length;
  return p.tier2
    .filter((c) => wordCount(c.word) === wordCount(p.answer) && Math.abs(letters(c.word).length - answerLength) <= 1)
    .map((c) => {
      const trap = traps?.has(pairKey(target.id, c.key)) ?? false;
      const twoHop = p.twoHop.has(graph.nodes.get(c.nodeId)?.group ?? -1);
      const status: NearMissStatus = trap ? 'confirmed-trap' : twoHop ? 'two-hop' : 'eligible';
      return { c, word: c.word, nodeId: c.nodeId, score: letterSimilarity(c.word, p.answer), status };
    })
    .sort((a, b) => b.score - a.score || (a.c.key < b.c.key ? -1 : 1));
}

/**
 * Ranked tier 3 candidates for review (report:near-misses). Includes skipped two-hop words so a parent can confirm them.
 * Scores against every synonym of the target and keeps each word's best.
 */
export function rankNearMisses(
  graph: SynonymGraph,
  target: Entry,
  pool: readonly Entry[],
  decisions: PairDecisions = {},
): NearMiss[] {
  const best = new Map<string, NearMiss>();
  for (const answer of target.synonyms) {
    const p = prepare(graph, target, answer, pool, decisions.pending);
    for (const { c, ...nm } of scoreNearMisses(graph, target, p, decisions.confirmedTraps)) {
      const prev = best.get(c.key);
      if (!prev || nm.score > prev.score) best.set(c.key, nm);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : 1));
}

/**
 * Picks `count` wrong options for `target`. Hard rule: no distractor shares a spelling with any word in the target's
 * connected synonym group, and no pending "also correct" report is offered. Tier 3 also skips groups two hops away
 * unless the pair is a confirmed trap. When a tier runs short it falls back to easier tiers.
 */
export function pickDistractors(graph: SynonymGraph, req: DistractorRequest): Distractor[] {
  const { target, tier, count, rng, pool, decisions = {} } = req;
  const p = prepare(graph, target, req.answer, pool, decisions.pending);
  const tier3 = scoreNearMisses(graph, target, p, decisions.confirmedTraps)
    .filter((nm) => nm.status !== 'two-hop')
    // Keep a shortlist of the closest so repeated rounds still vary.
    .slice(0, Math.max(count * 2, 6))
    .map((nm) => nm.c);

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
  // Same-category words two hops away are skipped in tier 2 as well, so a tier 3 fallback cannot bring them back.
  const tier2 = p.tier2.filter(
    (c) =>
      !p.twoHop.has(graph.nodes.get(c.nodeId)?.group ?? -1) ||
      (decisions.confirmedTraps?.has(pairKey(target.id, c.key)) ?? false),
  );
  if (tier >= 3) take(tier3, 3);
  if (tier >= 2) take(tier2, 2);
  take(p.tier1, 1);
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
