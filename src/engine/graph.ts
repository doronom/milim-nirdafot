import { normalizeWord } from '../content/text';
import type { Content, Entry, Pos, Sense } from '../content/types';

export interface GraphNode {
  /** "מהיר", "ערב#evening" (sense split) or "ישן#b039" (hinted headword). */
  id: string;
  /** Normalized spelling; two nodes may share it (homographs). */
  key: string;
  /** Display form as first written (keeps niqqud, e.g. רֵעַ). */
  word: string;
  /** Categories, parts of speech and entries this node occurs in (register sets add none). */
  categoryIds: string[];
  pos: Pos[];
  entryIds: string[];
  group: number;
}

export interface SynonymGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Set<string>>;
  /** Connected groups, largest first; each is a list of node ids. */
  groups: string[][];
  /** Node id for an occurrence of `word` inside an entry or register set. */
  resolve(itemId: string, word: string): string;
  headwordNode(entry: Entry): string;
  /** Normalized spellings of every node in the node's group: a distractor must match none of them. */
  groupKeys(nodeId: string): Set<string>;
}

export interface GraphOptions {
  /** Register sets are synonym sets by meaning, so they join the graph unless turned off. */
  includeRegisters?: boolean;
}

/**
 * Undirected graph linking every headword with its synonyms across all sources.
 * Shared spellings merge groups, except where a hint (hinted headwords) or senses.json splits the spelling into separate nodes.
 */
export function buildSynonymGraph(content: Content, { includeRegisters = true }: GraphOptions = {}): SynonymGraph {
  const entriesById = new Map(content.entries.map((e) => [e.id, e]));
  const splits = new Map<string, Sense[]>(content.senseSplits.map((s) => [normalizeWord(s.word), s.senses]));

  const resolve = (itemId: string, word: string): string => {
    const key = normalizeWord(word);
    const sense = splits.get(key)?.find((s) => s.items.includes(itemId));
    if (sense) return `${key}#${sense.key}`;
    const entry = entriesById.get(itemId);
    if (entry && entry.hint !== null && normalizeWord(entry.headword) === key) return `${key}#${entry.id}`;
    return key;
  };

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Set<string>>();
  const touch = (id: string, word: string, entry?: Entry): string => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, key: normalizeWord(word), word, categoryIds: [], pos: [], entryIds: [], group: -1 };
      nodes.set(id, node);
      edges.set(id, new Set());
    }
    if (entry) {
      if (!node.categoryIds.includes(entry.categoryId)) node.categoryIds.push(entry.categoryId);
      if (!node.pos.includes(entry.pos)) node.pos.push(entry.pos);
      if (!node.entryIds.includes(entry.id)) node.entryIds.push(entry.id);
    }
    return id;
  };
  const link = (a: string, b: string) => {
    if (a === b) return;
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  };

  for (const e of content.entries) {
    const h = touch(resolve(e.id, e.headword), e.headword, e);
    for (const s of e.synonyms) link(h, touch(resolve(e.id, s), s, e));
  }
  if (includeRegisters) {
    for (const r of content.registers) {
      const ids = [...r.everyday, ...r.standard, ...r.literary].map((w) => touch(resolve(r.id, w), w));
      for (const id of ids.slice(1)) link(ids[0]!, id);
    }
  }

  const groups: string[][] = [];
  for (const start of nodes.keys()) {
    if (nodes.get(start)!.group !== -1) continue;
    const index = groups.length;
    const members: string[] = [];
    const queue = [start];
    nodes.get(start)!.group = index;
    while (queue.length > 0) {
      const id = queue.pop()!;
      members.push(id);
      for (const n of edges.get(id)!) {
        const node = nodes.get(n)!;
        if (node.group === -1) {
          node.group = index;
          queue.push(n);
        }
      }
    }
    groups.push(members);
  }
  // Largest first, renumbering node.group to match.
  const order = groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.length - a.g.length || a.i - b.i);
  const sorted = order.map(({ g }) => g);
  sorted.forEach((g, i) => g.forEach((id) => (nodes.get(id)!.group = i)));

  const keysCache = new Map<number, Set<string>>();
  const groupKeys = (nodeId: string): Set<string> => {
    const group = nodes.get(nodeId)?.group;
    if (group === undefined) return new Set([normalizeWord(nodeId.split('#')[0]!)]);
    let keys = keysCache.get(group);
    if (!keys) {
      keys = new Set(sorted[group]!.map((id) => nodes.get(id)!.key));
      keysCache.set(group, keys);
    }
    return keys;
  };

  return {
    nodes,
    edges,
    groups: sorted,
    resolve,
    headwordNode: (entry) => resolve(entry.id, entry.headword),
    groupKeys,
  };
}
