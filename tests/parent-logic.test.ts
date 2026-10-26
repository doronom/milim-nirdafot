import { describe, expect, it } from 'vitest';
import { addActivity, minutesOn, reachedGoal, recentMinutes } from '../src/engine/activity';
import { boxCounts, masteredKeys, strugglingKeys, wordSummary } from '../src/engine/dashboard';
import type { LeitnerCard } from '../src/engine/leitner';
import { gateAnswer, gateQuestion } from '../src/engine/parent-gate';
import { initialProgress, resetJourney } from '../src/engine/progress';
import { createRng } from '../src/engine/rng';
import { createBackup, parseBackup, restoreBackup } from '../src/state/backup';
import { memoryStore } from '../src/storage/kv';

const card = (box: LeitnerCard['box'], lapses = 0, lastSeen = '2026-10-20'): LeitnerCard => ({
  box,
  due: '2026-10-20',
  seen: 4,
  lapses,
  lastSeen,
});

describe('play time', () => {
  it('adds seconds per day and reports whole minutes for the last week', () => {
    let p = initialProgress();
    p = addActivity(p, '2026-10-26', 600);
    p = addActivity(p, '2026-10-26', 330);
    p = addActivity(p, '2026-10-24', 60);
    expect(minutesOn(p, '2026-10-26')).toBe(15);
    expect(recentMinutes(p, '2026-10-26').map((d) => d.minutes)).toEqual([0, 0, 0, 0, 1, 0, 15]);
    expect(recentMinutes(p, '2026-10-26')[6]!.day).toBe('2026-10-26');
  });

  it('keeps 60 days', () => {
    let p = addActivity(initialProgress(), '2026-08-01', 60);
    p = addActivity(p, '2026-10-26', 60);
    expect(Object.keys(p.activity!)).toEqual(['2026-10-26']);
  });

  it('the daily goal is a note: reached at the parent-chosen minutes (default 15)', () => {
    const p = addActivity(initialProgress(), '2026-10-26', 14 * 60);
    expect(reachedGoal(p, '2026-10-26')).toBe(false);
    expect(reachedGoal({ ...p, settings: { ...p.settings, dailyGoal: 10 } }, '2026-10-26')).toBe(true);
  });
});

describe('dashboard numbers', () => {
  const leitner = { a: card(1, 3), b: card(2, 2, '2026-10-01'), c: card(2, 1), d: card(4), e: card(5), f: card(3) };

  it('counts boxes, mastered and struggling items', () => {
    expect(boxCounts(leitner)).toEqual({ 1: 1, 2: 2, 3: 1, 4: 1, 5: 1 });
    expect(wordSummary(leitner)).toEqual({ total: 6, mastered: 2, struggling: 2 });
    expect(strugglingKeys(leitner)).toEqual(['a', 'b']);
    expect(masteredKeys(leitner)).toEqual(['e', 'd']);
  });
});

describe('parent gate', () => {
  it('asks a multiplication with factors a child is unlikely to know by heart', () => {
    for (let i = 0; i < 50; i++) {
      const q = gateQuestion(createRng(i));
      expect(Math.min(q.a, q.b)).toBeGreaterThanOrEqual(6);
      expect(gateAnswer(q)).toBeGreaterThanOrEqual(36);
    }
  });
});

describe('reset', () => {
  it('starts the journey over but keeps the settings', () => {
    const p = {
      ...initialProgress(),
      onboarded: true,
      xp: 900,
      settings: { ...initialProgress().settings, childName: 'נועה' },
    };
    const r = resetJourney(addActivity(p, '2026-10-26', 60));
    expect(r.xp).toBe(0);
    expect(r.activity).toBeUndefined();
    expect(r.onboarded).toBe(true);
    expect(r.settings.childName).toBe('נועה');
  });
});

describe('backup', () => {
  it('exports everything as plain JSON and restores it on another device, recordings included', async () => {
    const progress = { ...initialProgress(), onboarded: true, xp: 321 };
    const overrides = { custom: [{ id: 'c-1', headword: 'ענווה' }] };
    const store = memoryStore({
      progress,
      'content:overrides': overrides,
      'review:also-correct': [{ id: 'x' }],
      'recording:c-1': new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'audio/webm' }),
    });
    const backup = await createBackup(store, new Date('2026-10-26T10:00:00Z'));
    const json = JSON.parse(JSON.stringify(backup));
    expect(json.format).toBe('word-quest-backup');
    expect(json.recordings['c-1']).toEqual({ type: 'audio/webm', base64: 'AQID+g==' });

    const other = memoryStore({ progress: initialProgress(), 'review:sentence-reports': [{ sentenceId: 'old' }] });
    await restoreBackup(other, parseBackup(json));
    expect(await other.get('progress')).toEqual(progress);
    expect(await other.get('content:overrides')).toEqual(overrides);
    expect(await other.get('review:sentence-reports')).toBeUndefined();
    const blob = await other.get<Blob>('recording:c-1');
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('refuses files that are not a backup', () => {
    expect(() => parseBackup({ format: 'word-quest-content-changes', version: 1 })).toThrow(/אינו קובץ גיבוי/);
    expect(() => parseBackup({ format: 'word-quest-backup', version: 1, data: {} })).toThrow(/נתוני התקדמות/);
  });
});
