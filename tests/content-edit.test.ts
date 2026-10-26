import { describe, expect, it } from 'vitest';
import { baseData, bundledContent, staticLayout } from '../src/app/data';
import { buildGameData } from '../src/app/game-data';
import { checkEdit } from '../src/content/edit-check';
import {
  customEntry,
  leitnerAfterEntryEdit,
  removeCustom,
  splitWords,
  upsertCustom,
  withEdit,
} from '../src/content/edits';
import { applyOverrides, emptyOverrides, isEdited, pairChanges, playable, revert } from '../src/content/overrides';
import { draftItems, reviewItems } from '../src/content/review-items';
import { CUSTOM_STATION_ID, findLevel } from '../src/engine/layout';
import type { LeitnerCard } from '../src/engine/leitner';
import { initialProgress, isLevelUnlocked } from '../src/engine/progress';

const card = (box: LeitnerCard['box'] = 3): LeitnerCard => ({
  box,
  due: '2026-10-20',
  seen: 3,
  lapses: 0,
  lastSeen: '2026-10-19',
});
const base = bundledContent;
const entry = (id: string) => base.entries.find((e) => e.id === id)!;

describe('override layer', () => {
  it('keeps only real changes and drops an edit equal to the original', () => {
    const ov = withEdit(emptyOverrides(), base, 'entries', 'b031', {
      headword: 'גדול',
      synonyms: ['ענק', 'עצום'],
      hidden: false,
    });
    expect(ov.entries.b031).toEqual({ synonyms: ['ענק', 'עצום'] });
    expect(isEdited(ov, 'entries', 'b031')).toBe(true);
    const back = withEdit(ov, base, 'entries', 'b031', { synonyms: entry('b031').synonyms });
    expect(back.entries.b031).toBeUndefined();
    expect(isEdited(revert(ov, 'entries', 'b031'), 'entries', 'b031')).toBe(false);
  });

  it('never touches the bundled data', () => {
    const before = JSON.stringify(entry('b031'));
    applyOverrides(base, withEdit(emptyOverrides(), base, 'entries', 'b031', { headword: 'ענקי' }));
    expect(JSON.stringify(entry('b031'))).toBe(before);
  });

  it('hides items from play but keeps them for validation, and applies review decisions', () => {
    let ov = withEdit(emptyOverrides(), base, 'scales', 'scale01', { hidden: true });
    ov = { ...ov, decisions: { e001: 'approved', idiom01: 'rejected' } };
    const full = applyOverrides(base, ov);
    expect(full.scales.find((s) => s.id === 'scale01')!.hidden).toBe(true);
    expect(full.entries.find((e) => e.id === 'e001')!.reviewed).toBe(true);
    const played = playable(full);
    expect(played.scales.some((s) => s.id === 'scale01')).toBe(false);
    expect(played.idioms.some((i) => i.id === 'idiom01')).toBe(false);
    expect(played.entries.some((e) => e.id === 'e001')).toBe(true);
  });

  it('splits a typed list of words', () => {
    expect(splitWords(' ענק,  עצום ,, כביר\nענק ')).toEqual(['ענק', 'עצום', 'כביר']);
  });
});

describe('checking an edit with the data rules', () => {
  const check = (fields: Record<string, unknown>, kind: 'entries' | 'scales' | 'contexts' = 'entries', id = 'b031') =>
    checkEdit(base, emptyOverrides(), withEdit(emptyOverrides(), base, kind, id, fields));

  it('allows a valid edit', () => {
    expect(check({ synonyms: ['ענק', 'עצום'] })).toEqual({ ok: true, problems: [] });
    expect(check({ difficulty: 2, hint: 'בגודל' })).toEqual({ ok: true, problems: [] });
  });

  it('blocks an invalid edit with a clear Hebrew reason', () => {
    const self = check({ synonyms: ['גדול'] });
    expect(self.ok).toBe(false);
    expect(self.problems.join(' ')).toContain('המילה מופיעה כנרדפת של עצמה');
    expect(check({ synonyms: [] }).problems.join(' ')).toContain('לפחות מילה נרדפת אחת');
    expect(check({ hint: 'ענק' }).problems.join(' ')).toContain('הרמז');
    expect(check({ headword: 'גדול!' }).problems.join(' ')).toContain('תו לא צפוי');
    expect(check({ weakToStrong: ['חם', 'לוהט'] }, 'scales', 'scale01').problems.join(' ')).toContain('לפחות 3');
  });

  it('blocks removing a synonym a sentence still relies on', () => {
    const r = check({ synonyms: ['עצום', 'כביר'] });
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('ראינו בגן החיות פיל גדול');
  });
});

describe('Leitner after an edit', () => {
  it('drops removed pairs and starts new pairs in box 1 when the entry is being learned', () => {
    const before = entry('b031');
    const after = { ...before, synonyms: ['ענק', 'עצום', 'כביר', 'רחב ידיים'] };
    expect(pairChanges(before, { ...before, synonyms: ['ענק'] }).removed).toEqual(['b031|עצום', 'b031|כביר']);
    const leitner = { 'b031|ענק': card(4), 'b031|כביר': card(2) };
    const next = leitnerAfterEntryEdit(leitner, before, { ...after, synonyms: ['ענק', 'רחב ידיים'] }, '2026-10-26');
    expect(next['b031|כביר']).toBeUndefined();
    expect(next['b031|ענק']!.box).toBe(4);
    expect(next['b031|רחב ידיים']).toMatchObject({ box: 1, due: '2026-10-26' });
  });

  it('does not add boxes for an entry the child has not met, unless it is a new custom word', () => {
    const before = entry('b031');
    const after = { ...before, synonyms: [...before.synonyms, 'רחב ידיים'] };
    expect(leitnerAfterEntryEdit({}, before, after, '2026-10-26')).toEqual({});
    const word = customEntry('c-1', {
      headword: 'ענווה',
      synonyms: ['צניעות'],
      hint: null,
      pos: 'noun',
      difficulty: 1,
    });
    expect(leitnerAfterEntryEdit({}, undefined, word, '2026-10-26', true)['c-1|צניעות']!.box).toBe(1);
  });
});

describe('game data from overrides', () => {
  const word = customEntry('c-1', {
    headword: 'ענווה',
    synonyms: ['צניעות', 'פשטות'],
    hint: null,
    pos: 'noun',
    difficulty: 1,
  });

  it('adds custom words as an always-open World 1 station that never blocks the boss', () => {
    const data = buildGameData(applyOverrides(base, upsertCustom(emptyOverrides(), word)), staticLayout);
    expect(data.layout.custom?.id).toBe(CUSTOM_STATION_ID);
    const levelId = data.layout.custom!.levels[0]!.id;
    const found = findLevel(data.layout, levelId)!;
    expect(found.level.itemIds).toEqual(['c-1']);
    expect(isLevelUnlocked(initialProgress(), found.world, levelId)).toBe(true);
    expect(data.layout.worlds[0]!.stations.some((s) => s.id === CUSTOM_STATION_ID)).toBe(false);
    expect(data.resolver.byKey('c-1|צניעות')).not.toBeNull();
    expect(baseData.layout.custom).toBeUndefined();
    const removed = buildGameData(
      applyOverrides(base, removeCustom(upsertCustom(emptyOverrides(), word), 'c-1')),
      staticLayout,
    );
    expect(removed.layout.custom).toBeUndefined();
  });

  it('takes hidden items out of the levels, and drops levels left empty', () => {
    const levelIds = baseData.layout.worlds[2]!.stations[0]!.levels.flatMap((l) => l.itemIds);
    let ov = emptyOverrides();
    for (const id of levelIds) ov = withEdit(ov, base, 'scales', id, { hidden: true });
    const data = buildGameData(applyOverrides(base, ov), staticLayout);
    expect(data.layout.worlds[2]!.stations.some((s) => s.kind === 'scales')).toBe(false);
    expect(data.content.scales).toHaveLength(0);
    expect(data.full.scales.length).toBeGreaterThan(0);
  });

  it('uses edited synonyms for answers', () => {
    const ov = withEdit(emptyOverrides(), base, 'entries', 'b031', { synonyms: ['ענק', 'עצום', 'כביר', 'אדיר'] });
    const data = buildGameData(applyOverrides(base, ov), staticLayout);
    expect(data.content.entries.find((e) => e.id === 'b031')!.synonyms).toContain('אדיר');
    expect(data.resolver.byKey('b031|אדיר')).not.toBeNull();
  });
});

describe('content review lists', () => {
  it('lists every kind, and drafts are the unreviewed items (custom words excluded)', () => {
    const ov = { ...emptyOverrides(), decisions: { e001: 'approved' as const } };
    const items = reviewItems(applyOverrides(base, ov), ov);
    const kinds = new Set(items.map((i) => i.kind));
    expect([...kinds].sort()).toEqual(['contexts', 'entries', 'idioms', 'registers', 'scales', 'sentences']);
    const drafts = draftItems(items);
    expect(drafts.some((d) => d.id === 'b031')).toBe(false);
    expect(drafts.find((d) => d.id === 'e001')!.decision).toBe('approved');
    expect(drafts.some((d) => d.id === 'scale01')).toBe(true);
  });
});
