import { normalizeWord } from '../content/text';
import type { Content } from '../content/types';

/**
 * Direct synonym links for answer checking: words listed in the same entry (headword-synonym and synonym-synonym)
 * and pairs from also-synonyms.json. Never transitive: sharing a connected group (see graph.ts) is only grounds for
 * keeping a word out of the distractors, not for accepting it as an answer.
 */
export interface SynonymLinks {
  areLinked(a: string, b: string): boolean;
  linksOf(word: string): ReadonlySet<string>;
}

/** also-synonyms.json names graph nodes ("מתוח#tense"); answer checking works on spellings. */
const nodeKey = (nodeId: string) => normalizeWord(nodeId.split('#')[0]!);

export function buildSynonymLinks(content: Content): SynonymLinks {
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      let set = links.get(x);
      if (!set) links.set(x, (set = new Set()));
      set.add(y);
    }
  };
  for (const e of content.entries) {
    const words = [e.headword, ...e.synonyms].map(normalizeWord);
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) link(words[i]!, words[j]!);
  }
  for (const { a, b } of content.alsoSynonyms) link(nodeKey(a), nodeKey(b));

  const empty: ReadonlySet<string> = new Set();
  return {
    areLinked: (a, b) => links.get(normalizeWord(a))?.has(normalizeWord(b)) ?? false,
    linksOf: (word) => links.get(normalizeWord(word)) ?? empty,
  };
}
