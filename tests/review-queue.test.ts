import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { claimAlsoCorrect, countsAsMistake, type Attempt } from '../src/engine/attempt';
import { buildSynonymGraph } from '../src/engine/graph';
import { decideReport, exportDecisions, listReports, pendingKeys, reportAlsoCorrect } from '../src/engine/review-queue';
import { memoryStore } from '../src/storage/kv';

const graph = buildSynonymGraph(content);
const target = content.entries.find((e) => e.id === 'e004')!; // מתוח
const now = new Date('2026-10-25T10:00:00Z');

describe('"also correct" claims', () => {
  it('do not count as a mistake', () => {
    const wrong: Attempt = { itemKey: 'e004|דרוך', outcome: 'wrong', chosen: 'חושש', at: now.toISOString() };
    const claimed = claimAlsoCorrect(wrong);
    expect(claimed.outcome).toBe('also-correct');
    expect(countsAsMistake(claimed.outcome)).toBe(false);
    expect(countsAsMistake('wrong')).toBe(true);
    const right: Attempt = { ...wrong, outcome: 'correct' };
    expect(claimAlsoCorrect(right)).toBe(right);
  });
});

describe('review queue', () => {
  it('queues a pair, counts repeats and exposes it as pending', async () => {
    const store = memoryStore();
    await reportAlsoCorrect(store, { target, word: 'חושש', nodeId: 'חושש', gameId: 'pickSynonym' }, now);
    const again = await reportAlsoCorrect(store, { target, word: 'חושש', nodeId: 'חושש', gameId: 'memory' }, now);
    expect(again.count).toBe(2);
    expect(again.gameId).toBe('pickSynonym');
    const reports = await listReports(store);
    expect(reports).toHaveLength(1);
    expect(pendingKeys(reports)).toEqual(new Set(['e004|חושש']));
  });

  it('keeps decisions and exports them in the data-file shapes', async () => {
    const store = memoryStore();
    await reportAlsoCorrect(store, { target, word: 'חושש', nodeId: 'חושש', gameId: 'pickSynonym' }, now);
    await reportAlsoCorrect(store, { target, word: 'רדום', nodeId: 'רדום', gameId: 'pickSynonym' }, now);
    await decideReport(store, 'e004|חושש', 'accepted', now);
    await decideReport(store, 'e004|רדום', 'rejected', now);
    // A decided pair keeps its decision when reported again.
    expect((await reportAlsoCorrect(store, { target, word: 'רדום', nodeId: 'רדום', gameId: 'x' }, now)).status).toBe('rejected');
    const reports = await listReports(store);
    expect(pendingKeys(reports).size).toBe(0);
    const out = exportDecisions(reports, graph, content.entries);
    expect(out.alsoSynonyms).toEqual([{ a: 'מתוח#tense', b: 'חושש', note: 'reported in pickSynonym' }]);
    expect(out.notSynonyms).toEqual([{ targetId: 'e004', distractor: 'רדום', note: 'reported in pickSynonym' }]);
  });

  it('rejects decisions on unknown reports', async () => {
    await expect(decideReport(memoryStore(), 'nope', 'accepted')).rejects.toThrow();
  });
});
