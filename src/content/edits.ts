import type { LeitnerState } from '../engine/leitner';
import { applyPairChanges } from '../engine/leitner';
import { CUSTOM_CATEGORY_ID } from './model';
import { pairChanges, type ContentOverrides, type OverrideKind } from './overrides';
import type { Content, Entry } from './types';

/** The bundled item of a kind by id (before any override). */
export function baseItem(base: Content, kind: OverrideKind, id: string): Record<string, unknown> | undefined {
  const list: readonly { id: string }[] = {
    entries: base.entries,
    scales: base.scales,
    registers: base.registers,
    contexts: base.contexts,
    idioms: base.idioms,
    sentences: base.sentences,
  }[kind];
  return list.find((x) => x.id === id) as Record<string, unknown> | undefined;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Stores only the fields that differ from the bundled item; an edit equal to the original removes the override, so
 * the "edited" badge means a real change. Hiding is `hidden: true`; un-hiding a visible original drops the field.
 */
export function withEdit(
  ov: ContentOverrides,
  base: Content,
  kind: OverrideKind,
  id: string,
  fields: Record<string, unknown>,
): ContentOverrides {
  const original = baseItem(base, kind, id) ?? {};
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'hidden') {
      if (Boolean(v) !== Boolean(original.hidden)) diff.hidden = Boolean(v);
    } else if (!same(v, original[k])) diff[k] = v;
  }
  const { [id]: _old, ...rest } = ov[kind] as Record<string, unknown>;
  void _old;
  return { ...ov, [kind]: Object.keys(diff).length > 0 ? { ...rest, [id]: diff } : rest };
}

/** A new custom-word id, unique on this device. */
export const newCustomId = (now = Date.now(), rand = Math.random()): string =>
  `c-${now.toString(36)}${Math.floor(rand * 1296)
    .toString(36)
    .padStart(2, '0')}`;

export interface CustomWordInput {
  headword: string;
  synonyms: string[];
  hint: string | null;
  pos: Entry['pos'];
  difficulty: Entry['difficulty'];
}

/** A parent word as an entry: its own category, reviewed (the parent wrote it). */
export const customEntry = (id: string, input: CustomWordInput): Entry => ({
  id,
  categoryId: CUSTOM_CATEGORY_ID,
  source: 'custom',
  reviewed: true,
  headword: input.headword,
  hint: input.hint,
  synonyms: input.synonyms,
  difficulty: input.difficulty,
  pos: input.pos,
});

export function upsertCustom(ov: ContentOverrides, entry: Entry): ContentOverrides {
  const exists = ov.custom.some((e) => e.id === entry.id);
  return { ...ov, custom: exists ? ov.custom.map((e) => (e.id === entry.id ? entry : e)) : [...ov.custom, entry] };
}

export function removeCustom(ov: ContentOverrides, id: string): ContentOverrides {
  const { [id]: _edit, ...entries } = ov.entries;
  void _edit;
  return { ...ov, custom: ov.custom.filter((e) => e.id !== id), entries };
}

/** Splits "a, b ,c" (or one per line) into clean words: trimmed, single spaces, no empties or repeats. */
export function splitWords(text: string): string[] {
  const words = text
    .split(/[,،\n]/)
    .map((w) => w.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  return [...new Set(words)];
}

/**
 * Leitner after an entry changed: pairs whose synonym was removed drop their boxes; new pairs start in box 1 when the
 * entry is already being learned (it has boxes) or `isNew` (a new custom word). A hidden entry keeps its boxes.
 */
export function leitnerAfterEntryEdit(
  leitner: LeitnerState,
  before: Pick<Entry, 'id' | 'synonyms'> | undefined,
  after: Pick<Entry, 'id' | 'synonyms'> | undefined,
  today: string,
  isNew = false,
): LeitnerState {
  const id = (before ?? after)?.id;
  if (!id) return leitner;
  const learning = Object.keys(leitner).some((k) => k.startsWith(`${id}|`));
  return applyPairChanges(leitner, pairChanges(before, after), today, isNew || learning);
}
