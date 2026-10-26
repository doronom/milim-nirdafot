import { normalizeWord } from '../content/text';
import type { Content, Entry } from '../content/types';
import type { LevelItem } from './types';

/** Looks items up by id or Leitner key, across every kind of content. */
export interface ItemResolver {
  /** A level item id (entry, scale, register set or context choice) as taught in a level. */
  byId(id: string): LevelItem | null;
  /** A Leitner key back to its item: "entryId|synonym" for pairs, the id otherwise. Null when the content lost it. */
  byKey(key: string): LevelItem | null;
}

/**
 * `entries` limits which entries count (e.g. reviewed-only); other kinds follow the content as given. A pair key
 * resolves to the exact synonym it was tracked with.
 */
export function createResolver(content: Content, entries: readonly Entry[] = content.entries): ItemResolver {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const others = new Map<string, LevelItem>([
    ...content.scales.map((s): [string, LevelItem] => [s.id, { kind: 'scale', key: s.id, scale: s }]),
    ...content.registers.map((r): [string, LevelItem] => [r.id, { kind: 'register', key: r.id, register: r }]),
    ...content.contexts.map((c): [string, LevelItem] => [c.id, { kind: 'context', key: c.id, context: c }]),
    ...content.idioms.map((i): [string, LevelItem] => [i.id, { kind: 'idiom', key: i.id, idiom: i }]),
  ]);
  return {
    byId: (id) => {
      const entry = entryById.get(id);
      if (entry)
        return {
          kind: 'pair',
          key: `${entry.id}|${normalizeWord(entry.synonyms[0]!)}`,
          entry,
          synonym: entry.synonyms[0]!,
        };
      return others.get(id) ?? null;
    },
    byKey: (key) => {
      if (!key.includes('|')) return others.get(key) ?? null;
      const [entryId = '', word = ''] = key.split('|');
      const entry = entryById.get(entryId);
      const synonym = entry?.synonyms.find((s) => normalizeWord(s) === word);
      return entry && synonym ? { kind: 'pair', key, entry, synonym } : null;
    },
  };
}

/** The entry or content id an item came from, so guests never repeat a level's own material. */
export const sourceId = (item: LevelItem): string => (item.kind === 'pair' ? item.entry.id : item.key);
