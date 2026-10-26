import type { Content } from '../content/types';

/**
 * Every text the game reads aloud from the bundled content: each word (headwords, synonyms, scale and register words,
 * context options, idioms), each example sentence and each idiom example. Clips are keyed by the exact text, so a
 * word or sentence the parent edits has no clip and is read by the browser voice instead of a stale recording.
 * Pointed spellings (רֵעַ) keep their niqqud, which also guides the voice.
 */
export function clipTexts(content: Content): string[] {
  return [
    ...new Set(
      [
        ...content.entries.flatMap((e) => [e.headword, ...e.synonyms]),
        ...content.scales.flatMap((s) => s.weakToStrong),
        ...content.registers.flatMap((r) => [...r.everyday, ...r.standard, ...r.literary]),
        ...content.contexts.flatMap((c) => c.options),
        ...content.idioms.flatMap((i) => [i.idiom, i.example]),
        ...content.sentences.map((s) => s.text),
      ].map((t) => t.trim()),
    ),
  ];
}
