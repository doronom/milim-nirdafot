import { HAS_NIQQUD, stripNiqqud } from './text';
import type { Content } from './types';

/**
 * Words show without niqqud (the handoff rule for a 10-year-old). Niqqud stays only on words the content itself
 * points, and only when the bare spelling is also a different word in the content, e.g. רֵעַ (friend) vs רע (bad).
 */
export function createDisplayWord(content: Content): (word: string) => string {
  const plain = new Set<string>();
  const pointed = new Set<string>();
  const all = [
    ...content.entries.flatMap((e) => [e.headword, ...e.synonyms]),
    ...content.registers.flatMap((r) => [...r.everyday, ...r.standard, ...r.literary]),
  ];
  for (const w of all) (HAS_NIQQUD.test(w) ? pointed : plain).add(w);
  return (word) => (pointed.has(word) && plain.has(stripNiqqud(word)) ? word : stripNiqqud(word));
}

/** A short label for any level item id, used for the word previews on the path. */
export function createItemLabel(content: Content): (id: string) => string | undefined {
  const display = createDisplayWord(content);
  const labels = new Map<string, string>([
    ...content.entries.map((e): [string, string] => [e.id, display(e.headword)]),
    ...content.scales.map((s): [string, string] => [s.id, s.theme]),
    ...content.registers.map((r): [string, string] => [r.id, r.meaning]),
    ...content.contexts.map((c): [string, string] => [c.id, c.answer]),
    ...content.idioms.map((i): [string, string] => [i.id, i.idiom]),
  ]);
  return (id) => labels.get(id);
}
