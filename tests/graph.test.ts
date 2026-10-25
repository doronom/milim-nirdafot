import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { MAX_GROUP_WORDS } from '../src/content/validate';
import { buildSynonymGraph } from '../src/engine/graph';

const graph = buildSynonymGraph(content);
const entry = (id: string) => content.entries.find((e) => e.id === id)!;
const groupOf = (nodeId: string) => graph.nodes.get(nodeId)!.group;
const sameGroup = (a: string, b: string) => groupOf(a) === groupOf(b);

describe('synonym graph', () => {
  it('links every headword with all of its synonyms', () => {
    for (const e of content.entries) {
      const h = graph.headwordNode(e);
      for (const s of e.synonyms) expect(sameGroup(h, graph.resolve(e.id, s)), `${e.id} ${s}`).toBe(true);
    }
  });

  it('merges groups through shared words (מהיר / זריז / חפוז)', () => {
    expect(sameGroup('מהיר', 'זריז')).toBe(true);
    expect(sameGroup('מהיר', 'פזיז')).toBe(true);
    expect(sameGroup('קל רגליים', 'נמהר')).toBe(true);
  });

  it('keeps hinted homographs apart: ישן, קרא, הודה, העריך', () => {
    expect(graph.headwordNode(entry('b039'))).toBe('ישן#b039');
    expect(graph.headwordNode(entry('b163'))).toBe('ישן#b163');
    expect(sameGroup('ישן#b039', 'ישן#b163')).toBe(false);
    // קרא "בספר" vs קרא as a synonym of פנה (called).
    expect(sameGroup(graph.headwordNode(entry('b212')), graph.resolve('b209', 'קרא'))).toBe(false);
    // הודה "אמר תודה" vs הודה as a synonym of התוודה (confessed).
    expect(sameGroup(graph.headwordNode(entry('e047')), graph.resolve('b197', 'הודה'))).toBe(false);
    // העריך "נתן כבוד" vs העריך as a synonym of ניחש (estimated).
    expect(sameGroup(graph.headwordNode(entry('e063')), graph.resolve('b242', 'העריך'))).toBe(false);
  });

  it('keeps the two פחד entries apart once hinted', () => {
    expect(sameGroup(graph.headwordNode(entry('b023')), graph.headwordNode(entry('b244')))).toBe(false);
  });

  it('splits sense-override words into separate nodes', () => {
    expect(graph.resolve('b406', 'ערב')).toBe('ערב#evening');
    expect(graph.resolve('b118', 'ערב')).toBe('ערב#tasty');
    expect(sameGroup(graph.resolve('b406', 'ערב'), 'טעים')).toBe(false);
    expect(sameGroup(graph.resolve('b021', 'נוגה'), 'אור')).toBe(false);
    expect(sameGroup(graph.resolve('b304', 'רֵעַ'), 'גרוע')).toBe(false);
    expect(graph.resolve('reg02', 'רֵעַ')).toBe('רע#friend');
    expect(sameGroup(graph.resolve('b294', 'צר'), 'דחוק')).toBe(false);
  });

  it('falls back to the plain word for items a split does not list', () => {
    expect(graph.resolve('b001', 'ערב')).toBe('ערב');
  });

  it('includes register sets as synonym links', () => {
    expect(sameGroup('אחלה', 'טוב')).toBe(true);
    expect(sameGroup('סבבה', 'תקין')).toBe(true);
  });

  it('keeps every group within the size cap', () => {
    expect(Math.max(...graph.groups.map((g) => g.length))).toBeLessThanOrEqual(MAX_GROUP_WORDS);
  });

  it('returns the spellings of a whole group', () => {
    expect(graph.groupKeys('ערב#tasty')).toEqual(new Set(['טעים', 'ערב', 'משובח']));
  });
});
