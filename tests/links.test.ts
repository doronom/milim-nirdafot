import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { buildSynonymGraph } from '../src/engine/graph';
import { buildSynonymLinks } from '../src/engine/links';

const links = buildSynonymLinks(content);
const graph = buildSynonymGraph(content);

describe('direct synonym links (answer checking)', () => {
  it('links a headword with each synonym, both ways', () => {
    expect(links.areLinked('גדול', 'ענק')).toBe(true);
    expect(links.areLinked('ענק', 'גדול')).toBe(true);
  });

  it('links synonyms of the same entry with each other', () => {
    expect(links.areLinked('ענק', 'עצום')).toBe(true);
  });

  it('links pairs from also-synonyms.json by spelling', () => {
    expect(links.areLinked('מתוח', 'חרד')).toBe(true);
  });

  it('does not accept טעים-טוב although they share a connected group', () => {
    const sameGroup = graph.nodes.get('טעים')!.group === graph.nodes.get('טוב')!.group;
    expect(sameGroup).toBe(true);
    expect(links.areLinked('טעים', 'טוב')).toBe(false);
  });

  it('is never transitive: synonym of a synonym is not a pair', () => {
    // מהיר-זריז (b120) and זריז-קל רגליים (b077), but מהיר-קל רגליים only through זריז... both are in b077.
    expect(links.areLinked('מהיר', 'קל רגליים')).toBe(true);
    // חפוז links מהיר (b120) and פזיז (b101); מהיר-פזיז is not listed anywhere.
    expect(links.areLinked('מהיר', 'פזיז')).toBe(false);
  });

  it('ignores niqqud and does not link a word with itself', () => {
    expect(links.areLinked('רֵעַ', 'חבר')).toBe(true);
    expect(links.areLinked('גדול', 'גדול')).toBe(false);
  });
});
