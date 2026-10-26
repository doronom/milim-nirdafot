import { normalizeWord } from '../content/text';
import type { Content, Entry, Pos, Sense } from '../content/types';

/**
 * Node ids never depend on hint text, so editing a hint only changes a label:
 * - a plain spelling: "מהיר";
 * - a separated headword (a homograph, or listed in senses.json separateHeadwords): its entry id plus ".0", "b039.0";
 * - a sense from senses.json: the sense's first item plus its key in senses.json, "b406.evening" (an index would
 *   collide: two split words can share a first item).
 * "<entryId>.0" is also accepted for any entry as an alias of its headword node, whatever that node is.
 */
export const headwordAlias = (entryId: string): string => `${entryId}.0`;

export interface GraphNode {
  id: string;
  /** Readable name for reports: "מהיר", "ערב#evening" (sense key), "ישן#b039" (separated headword). */
  label: string;
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
  /** The node an id or alias ("b031.0") stands for, or undefined. */
  canonical(id: string): string | undefined;
  /** Maps an id written before stable ids ("מתוח#tense", "ישן#b039") to today's id; other ids pass through. */
  migrate(id: string): string;
  headwordNode(entry: Entry): string;
  /** Normalized spellings of every node in the node's group: a distractor must match none of them. */
  groupKeys(nodeId: string): Set<string>;
  /**
   * Groups two hops away: reached by leaving the group through a shared spelling (a split sense or hinted homograph)
   * and taking one more synonym step. Tier 3 skips them until a parent confirms the trap.
   */
  twoHopGroups(nodeId: string): Set<number>;
}

export interface GraphOptions {
  /** Register sets are synonym sets by meaning, so they join the graph unless turned off. */
  includeRegisters?: boolean;
}

/**
 * Undirected graph linking every headword with its synonyms across all sources.
 * Shared spellings merge groups, except where a hint (hinted headwords) or senses.json splits the spelling into separate nodes.
 * also-synonyms.json adds links the sources miss.
 */
export function buildSynonymGraph(content: Content, { includeRegisters = true }: GraphOptions = {}): SynonymGraph {
  const entriesById = new Map(content.entries.map((e) => [e.id, e]));
  const splits = new Map<string, Sense[]>(content.senseSplits.map((s) => [normalizeWord(s.word), s.senses]));
  const separated = separatedHeadwords(content);
  const labels = new Map<string, string>();

  const resolve = (itemId: string, word: string): string => {
    const key = normalizeWord(word);
    const senses = splits.get(key);
    const index = senses?.findIndex((s) => s.items.includes(itemId)) ?? -1;
    if (senses && index >= 0) {
      const id = senseNodeId(senses[index]!);
      labels.set(id, `${key}#${senses[index]!.key}`);
      return id;
    }
    const entry = entriesById.get(itemId);
    if (entry && separated.has(entry.id) && normalizeWord(entry.headword) === key) {
      labels.set(headwordAlias(entry.id), `${key}#${entry.id}`);
      return headwordAlias(entry.id);
    }
    return key;
  };

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Set<string>>();
  const touch = (id: string, word: string, entry?: Entry): string => {
    let node = nodes.get(id);
    if (!node) {
      const label = labels.get(id) ?? id;
      node = { id, label, key: normalizeWord(word), word, categoryIds: [], pos: [], entryIds: [], group: -1 };
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

  // Every entry's "<id>.0" names its headword node, so a pair written that way survives any change to the node.
  const aliases = new Map<string, string>();
  for (const e of content.entries) aliases.set(headwordAlias(e.id), resolve(e.id, e.headword));
  const canonical = (id: string) => (nodes.has(id) ? id : aliases.get(id));
  const byLabel = new Map([...nodes.values()].map((n) => [n.label, n.id]));
  const migrate = (id: string) => (canonical(id) ? id : (byLabel.get(id) ?? id));

  // Reviewed pairs the sources miss. Unknown node ids are reported by validation and skipped here.
  for (const { a, b } of content.alsoSynonyms) {
    const [x, y] = [canonical(a), canonical(b)];
    if (x && y) link(x, y);
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
    if (group === undefined) return new Set([normalizeWord(nodeId)]);
    let keys = keysCache.get(group);
    if (!keys) {
      keys = new Set(sorted[group]!.map((id) => nodes.get(id)!.key));
      keysCache.set(group, keys);
    }
    return keys;
  };

  const keyIndex = new Map<string, string[]>();
  for (const node of nodes.values()) keyIndex.set(node.key, [...(keyIndex.get(node.key) ?? []), node.id]);
  const twoHopGroups = (nodeId: string): Set<number> => {
    const own = nodes.get(nodeId)?.group;
    const out = new Set<number>();
    for (const key of groupKeys(nodeId)) {
      for (const sibling of keyIndex.get(key) ?? []) {
        const g = nodes.get(sibling)!.group;
        if (g !== own) out.add(g);
      }
    }
    return out;
  };

  return {
    nodes,
    edges,
    groups: sorted,
    resolve,
    canonical,
    migrate,
    headwordNode: (entry) => resolve(entry.id, entry.headword),
    groupKeys,
    twoHopGroups,
  };
}

/** A sense's node id: its first item and its key ("0" is kept for headwords). */
export const senseNodeId = (sense: Sense): string => `${sense.items[0]}.${sense.key}`;

/**
 * Headwords that get a node of their own instead of merging with the same spelling elsewhere: those listed in
 * senses.json (a meaning the spelling has nowhere else), and every homograph headword (two entries, one spelling).
 */
export function separatedHeadwords(content: Pick<Content, 'entries' | 'separateHeadwords'>): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const e of content.entries) {
    const key = normalizeWord(e.headword);
    byKey.set(key, [...(byKey.get(key) ?? []), e.id]);
  }
  const homographs = [...byKey.values()].filter((ids) => ids.length > 1).flat();
  return new Set([...content.separateHeadwords, ...homographs]);
}

/**
 * The spelling a node id stands for, from the content alone (answer checking does not build the graph): the entry's
 * headword for "<id>.0", the split word for a sense id, the id itself for a plain spelling.
 */
export function nodeSpelling(content: Pick<Content, 'entries' | 'senseSplits'>, id: string): string {
  const m = /^([a-z][\w-]*)\.([\w-]+)$/i.exec(id);
  if (!m) return normalizeWord(id);
  const [, item, tag] = m as unknown as [string, string, string];
  if (tag === '0') {
    const entry = content.entries.find((e) => e.id === item);
    return entry ? normalizeWord(entry.headword) : id;
  }
  const split = content.senseSplits.find((s) => s.senses.some((x) => x.key === tag && x.items[0] === item));
  return split ? normalizeWord(split.word) : id;
}
