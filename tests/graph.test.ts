import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { MAX_GROUP_WORDS } from '../src/content/validate';
import { buildSynonymGraph } from '../src/engine/graph';

const graph = buildSynonymGraph(content);
const entry = (id: string) => content.entries.find((e) => e.id === id)!;
const groupOf = (nodeId: string) => graph.nodes.get(nodeId)!.group;
const sameGroup = (a: string, b: string) => groupOf(a) === groupOf(b);
/** Node id from its readable label ("ערב#evening", "ישן#b039"). */
const node = (label: string) => graph.migrate(label);

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

  it('keeps separated headwords apart: ישן, קרא, הודה, העריך', () => {
    expect(graph.headwordNode(entry('b039'))).toBe('b039.0');
    expect(graph.headwordNode(entry('b163'))).toBe('b163.0');
    expect(graph.nodes.get('b039.0')!.label).toBe('ישן#b039');
    expect(sameGroup('b039.0', 'b163.0')).toBe(false);
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
    expect(graph.resolve('b406', 'ערב')).toBe('b406.evening');
    expect(graph.resolve('b118', 'ערב')).toBe('b118.pleasant');
    expect(graph.resolve('b133', 'ערב')).toBe('b118.pleasant');
    expect(sameGroup(graph.resolve('b406', 'ערב'), 'טעים')).toBe(false);
    expect(sameGroup(graph.resolve('b021', 'נוגה'), 'אור')).toBe(false);
    expect(sameGroup(graph.resolve('b304', 'רֵעַ'), 'גרוע')).toBe(false);
    expect(graph.nodes.get(graph.resolve('reg02', 'רֵעַ'))!.label).toBe('רע#friend');
    expect(sameGroup(graph.resolve('b294', 'צר'), 'דחוק')).toBe(false);
  });

  it('falls back to the plain word for items a split does not list', () => {
    expect(graph.resolve('b001', 'ערב')).toBe('ערב');
  });

  it('includes register sets as synonym links', () => {
    expect(sameGroup('אחלה', 'טוב')).toBe(true);
    expect(sameGroup('סבבה', 'תקין')).toBe(true);
  });

  it('links reviewed pairs from also-synonyms.json', () => {
    expect(sameGroup(node('מתוח#tense'), 'חרד')).toBe(true);
    expect(sameGroup(node('מתוח#tense'), 'מוטרד')).toBe(true);
  });

  it('returns the spellings of a whole group', () => {
    const keys = graph.groupKeys(graph.resolve('b118', 'ערב'));
    expect(keys.has('טעים') && keys.has('ערב') && keys.has('נעים')).toBe(true);
    expect(keys.has('שקיעה')).toBe(false);
  });

  it('finds groups two hops away through a shared spelling', () => {
    // עף -> טס (flew) shares the spelling טס with רץ -> טס (ran fast).
    expect(graph.twoHopGroups('עף').has(groupOf('דהר'))).toBe(true);
    // חלק (משטח) shares its spelling with שטוח's synonym חלק.
    expect(graph.twoHopGroups(node('חלק#e015')).has(groupOf('שטוח'))).toBe(true);
    expect(graph.twoHopGroups('עף').has(groupOf('עף'))).toBe(false);
  });

  it('names nodes by stable item ids, never by hint text', () => {
    // "<entryId>.0" is an alias of any entry's headword node, separated or not.
    expect(graph.canonical('b031.0')).toBe('גדול');
    expect(graph.canonical('b039.0')).toBe('b039.0');
    // Hints are labels only: removing or changing one leaves the node where it was.
    const relabel = (id: string, hint: string | null) =>
      buildSynonymGraph({ ...content, entries: content.entries.map((e) => (e.id === id ? { ...e, hint } : e)) });
    expect(relabel('e063', null).headwordNode(entry('e063'))).toBe('e063.0');
    expect(relabel('e063', 'הוקיר').headwordNode(entry('e063'))).toBe('e063.0');
    // Labels written before stable ids map to today's ids.
    expect(graph.migrate('מתוח#tense')).toBe('e004.tense');
    expect(graph.migrate('ישן#b163')).toBe('b163.0');
    expect(graph.migrate('חרד')).toBe('חרד');
  });

  it('has groups above the warning threshold only as warnings', () => {
    expect(Math.max(...graph.groups.map((g) => g.length))).toBeGreaterThan(MAX_GROUP_WORDS);
  });
});
