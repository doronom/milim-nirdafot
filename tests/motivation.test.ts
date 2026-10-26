import { describe, expect, it } from 'vitest';
import { certificateDates, gematria } from '../src/engine/certificate';
import { currentStreak, touchStreak, weekCalendar, weekOf, type Streak } from '../src/engine/streak';

const fresh: Streak = { days: 0, freezes: 1, lastPlayed: null };

describe('Hebrew dates', () => {
  it('writes numbers in gematria with gershayim, and 15/16 as ט״ו/ט״ז', () => {
    expect([1, 10, 15, 16, 24, 30].map(gematria)).toEqual(['א׳', 'י׳', 'ט״ו', 'ט״ז', 'כ״ד', 'ל׳']);
    expect(gematria(5786)).toBe('תשפ״ו');
    expect(gematria(5785)).toBe('תשפ״ה');
    expect(gematria(5800)).toBe('ת״ת');
  });

  it('formats both certificate dates from the given day', () => {
    expect(certificateDates(new Date(2025, 10, 15))).toEqual({ gregorian: '15.11.2025', hebrew: 'כ״ד בחשוון תשפ״ו' });
    expect(certificateDates(new Date(2026, 9, 26)).hebrew).toBe('ט״ו בחשוון תשפ״ז');
  });
});

describe('streak', () => {
  it('counts consecutive days and ignores a second play on the same day', () => {
    let s = touchStreak(fresh, '2026-10-25');
    s = touchStreak(s, '2026-10-25');
    s = touchStreak(s, '2026-10-26');
    expect(s.days).toBe(2);
  });

  it('covers one missed day with the weekly freeze, automatically', () => {
    let s = touchStreak(touchStreak(fresh, '2026-10-25'), '2026-10-26');
    s = touchStreak(s, '2026-10-28');
    expect(s).toMatchObject({ days: 3, freezes: 0, frozen: ['2026-10-27'] });
    // A second miss the same week starts over, quietly.
    s = touchStreak(s, '2026-10-30');
    expect(s.days).toBe(1);
  });

  it('refills the freeze each week (weeks start on Sunday)', () => {
    expect(weekOf('2026-10-28')).toBe('2026-10-25');
    expect(weekOf('2026-10-25')).toBe('2026-10-25');
    const used: Streak = { days: 5, freezes: 0, freezeWeek: '2026-10-25', lastPlayed: '2026-10-31' };
    expect(touchStreak(used, '2026-11-02')).toMatchObject({ days: 6, freezes: 0, frozen: ['2026-11-01'] });
  });

  it('shows the current streak without playing: covered gaps keep it, longer gaps show 0', () => {
    const s: Streak = { days: 4, freezes: 1, freezeWeek: '2026-10-25', lastPlayed: '2026-10-26' };
    expect(currentStreak(s, '2026-10-27')).toBe(4);
    expect(currentStreak(s, '2026-10-28')).toBe(4);
    expect(currentStreak(s, '2026-10-29')).toBe(0);
    expect(currentStreak(fresh, '2026-10-29')).toBe(0);
  });

  it('draws the week with played, frozen, open and future days', () => {
    const s = touchStreak(touchStreak(touchStreak(fresh, '2026-10-25'), '2026-10-26'), '2026-10-28');
    expect(weekCalendar(s, '2026-10-29').map((d) => d.state)).toEqual([
      'played',
      'played',
      'frozen',
      'played',
      'open',
      'future',
      'future',
    ]);
  });
});

import { placeSticker, stickerState, worldStickers } from '../src/engine/album';
import { buildLayout, worldLevels } from '../src/engine/layout';
import { content } from '../src/content';
import { initialProgress, markPlayed } from '../src/engine/progress';
import { buildDuel, decisiveQuestions, duelStats, duelWinner, type DuelAnswer } from '../src/games/duel/duel';
import { shareOrDownload } from '../src/share/share-image';
import { envFor } from './helpers';
import { vi } from 'vitest';

const layout = buildLayout(content);

describe('album', () => {
  it('has one sticker per level, the boss sticker golden', () => {
    for (const w of layout.worlds) {
      const stickers = worldStickers(layout, w.id, () => 'x');
      expect(stickers.map((s) => s.levelId)).toEqual(worldLevels(w).map((l) => l.id));
      expect(stickers.filter((s) => s.golden).map((s) => s.levelId)).toEqual([w.boss.id]);
    }
  });

  it('locks a sticker until its level is done, then waits for the child to place it', () => {
    const p = initialProgress();
    expect(stickerState(p, 'w1-emotions-1')).toBe('locked');
    expect(placeSticker(p, 'w1-emotions-1')).toBe(p);
    const done = { ...p, levels: { 'w1-emotions-1': { stars: 1 as const, bestAccuracy: 0.5, completedAt: 'x' } } };
    expect(stickerState(done, 'w1-emotions-1')).toBe('waiting');
    const placed = placeSticker(done, 'w1-emotions-1');
    expect(stickerState(placed, 'w1-emotions-1')).toBe('placed');
    expect(placeSticker(placed, 'w1-emotions-1')).toBe(placed);
  });

  it('records play for the streak', () => {
    expect(markPlayed(initialProgress(), '2026-10-26').streak).toMatchObject({ days: 1, lastPlayed: '2026-10-26' });
  });
});

describe('duel', () => {
  const env = envFor();
  it('builds the chosen number of questions from the chosen worlds, the same for both players', () => {
    for (const length of [5, 10, 15] as const) {
      const qs = buildDuel(env, [1, 2, 3, 4], length, 's');
      expect(qs).toHaveLength(length);
      for (const q of qs) expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
      expect(buildDuel(env, [1, 2, 3, 4], length, 's')).toEqual(qs);
    }
    expect(buildDuel(env, [3], 5, 's').every((q) => q.sentence !== undefined)).toBe(true);
    expect(buildDuel(env, [4], 5, 's').every((q) => content.idioms.some((i) => i.idiom === q.prompt))).toBe(true);
  });

  it('compares right answers, then speed, and finds the deciding words', () => {
    const qs = buildDuel(env, [1], 5, 'd');
    const play = (rights: boolean[], ms: number): DuelAnswer[] =>
      qs.map((q, i) => ({ questionId: q.id, choice: '', correct: rights[i]!, ms }));
    const a = play([true, true, false, true, true], 3000);
    const b = play([true, false, false, true, true], 2000);
    expect(duelStats(a)).toEqual({ correct: 4, total: 5, avgMs: 3000, bestStreak: 2 });
    expect(duelWinner(duelStats(a), duelStats(b))).toBe(0);
    expect(duelWinner(duelStats(play([true, true, true, true, false], 4000)), duelStats(a))).toBe(1);
    expect(duelWinner(duelStats(a), duelStats(a))).toBe('tie');
    expect(decisiveQuestions(qs, a, b).map((q) => q.id)).toEqual([qs[1]!.id]);
  });
});

describe('share or download', () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const fakeNav = (share?: () => Promise<void>) =>
    ({ canShare: share ? () => true : undefined, share }) as unknown as Navigator;

  it('shares the image when the device can share files', async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareOrDownload(blob, 'a.png', 't', fakeNav(share))).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('downloads when sharing files is not supported or fails, and reports a dismissed share as cancelled', async () => {
    const click = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    vi.stubGlobal('document', {
      createElement: () => ({ click, remove: () => undefined }),
      body: { append: () => undefined },
    });
    expect(await shareOrDownload(blob, 'a.png', 't', fakeNav())).toBe('downloaded');
    expect(
      await shareOrDownload(
        blob,
        'a.png',
        't',
        fakeNav(async () => Promise.reject(new Error('nope'))),
      ),
    ).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
    expect(
      await shareOrDownload(
        blob,
        'a.png',
        't',
        fakeNav(async () => Promise.reject(new DOMException('x', 'AbortError'))),
      ),
    ).toBe('cancelled');
    vi.unstubAllGlobals();
  });
});
