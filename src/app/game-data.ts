import { onlyReviewed } from '../content';
import { createDisplayWord, createItemLabel } from '../content/display';
import { playable } from '../content/overrides';
import type { Content, Entry, Sentence } from '../content/types';
import { buildSynonymGraph, type SynonymGraph } from '../engine/graph';
import { customStation, type Layout, type LevelDef, type WorldDef } from '../engine/layout';
import { buildSynonymLinks, type SynonymLinks } from '../engine/links';
import { trapKeys } from '../engine/distractors';
import { createResolver, type ItemResolver } from '../games/items';
import type { GameEnv } from '../games/types';

/** Everything the screens read about the content, rebuilt whenever the parent's overrides change. */
export interface GameData {
  /** Content with overrides applied, hidden items included (for review, editing and validation). */
  full: Content;
  /** Content as played: hidden and rejected items left out. */
  content: Content;
  /** Built from the full content, so even a hidden word keeps blocking it as a wrong option. */
  graph: SynonymGraph;
  /** Direct links for answer checking, from the played content. */
  links: SynonymLinks;
  /** The build-time layout plus the custom-words station. */
  layout: Layout;
  resolver: ItemResolver;
  displayWord: (word: string) => string;
  itemLabel: (id: string) => string | undefined;
  entryPool: (reviewedOnly: boolean, worldId: number) => readonly Entry[];
  guestPool: (reviewedOnly: boolean) => readonly Entry[];
  guestResolver: (reviewedOnly: boolean) => ItemResolver;
  sentenceFor: (entry: Entry, reviewedOnly: boolean) => Sentence | undefined;
  stickerLabel: (level: LevelDef) => string;
  /** The game environment outside levels (placement, speed run, duel): every played word, all sentences. */
  freePlay: GameEnv;
}

/** Drops hidden items from the build-time layout, then empty levels and stations (level ids stay stable). */
function pruneLayout(layout: Layout, known: (id: string) => boolean): Layout {
  const worlds: WorldDef[] = layout.worlds.map((w) => ({
    ...w,
    stations: w.stations
      .map((s) => ({
        ...s,
        levels: s.levels
          .map((l) => (l.kind === 'learn' ? { ...l, itemIds: l.itemIds.filter(known) } : l))
          .filter((l) => l.kind !== 'learn' || l.itemIds.length > 0),
      }))
      .filter((s) => s.levels.length > 0),
  }));
  return { worlds };
}

export function buildGameData(full: Content, staticLayout: Layout): GameData {
  const content = playable(full);
  const reviewedIds = new Set(onlyReviewed(content).entries.map((e) => e.id));
  const reviewed = content.entries.filter((e) => reviewedIds.has(e.id));
  const worldOne = content.entries.filter((e) => e.source === 'booklet' && e.difficulty === 1);
  const itemLabel = createItemLabel(content);
  const guestResolvers = { all: createResolver(content), reviewed: createResolver(content, reviewed) };
  const pruned = pruneLayout(staticLayout, (id) => guestResolvers.all.byId(id) !== null);
  const station = customStation(content);
  const custom = station && { ...station, index: pruned.worlds[0]!.stations.length + 1 };
  const graph = buildSynonymGraph(full);
  const links = buildSynonymLinks(content);
  const displayWord = createDisplayWord(content);
  return {
    full,
    content,
    graph,
    links,
    layout: custom ? { ...pruned, custom } : pruned,
    resolver: guestResolvers.all,
    displayWord,
    itemLabel,
    // World 1 sticks to the everyday booklet words it teaches, so a wrong option is never a rare word.
    entryPool: (reviewedOnly, worldId) => {
      const pool = worldId === 1 ? worldOne : content.entries;
      return reviewedOnly ? pool.filter((e) => reviewedIds.has(e.id)) : pool;
    },
    guestPool: (reviewedOnly) => (reviewedOnly ? reviewed : content.entries),
    guestResolver: (reviewedOnly) => (reviewedOnly ? guestResolvers.reviewed : guestResolvers.all),
    sentenceFor: (entry, reviewedOnly) =>
      content.sentences.find((s) => s.entryId === entry.id && (!reviewedOnly || s.reviewed)),
    stickerLabel: (level) => (level.itemIds[0] ? (itemLabel(level.itemIds[0]) ?? 'חזרה') : 'חזרה'),
    freePlay: {
      content,
      sentences: { reviewedOnly: false, blocked: new Set() },
      graph,
      links,
      pool: content.entries,
      decisions: { confirmedTraps: trapKeys(content.notSynonyms) },
      displayWord,
    },
  };
}
