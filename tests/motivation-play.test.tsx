// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({ toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));

import { App } from '../src/app/App';
import { content } from '../src/content';
import { applyTokens } from '../src/design/tokens';
import { dayKey } from '../src/engine/dates';
import { buildLayout, worldLevels } from '../src/engine/layout';
import { buildSynonymLinks } from '../src/engine/links';
import { initialProgress, type Progress } from '../src/engine/progress';
import { memoryStore, type KeyValueStore } from '../src/storage/kv';

const layout = buildLayout(content);
const links = buildSynonymLinks(content);
const w1 = layout.worlds[0]!;
const started = (extra: Partial<Progress> = {}): Progress => ({ ...initialProgress(), onboarded: true, ...extra });
const done = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { stars: 3 as const, bestAccuracy: 1, completedAt: 'x' }]));

function open(hash: string, progress: Progress, store: KeyValueStore = memoryStore()) {
  window.location.hash = hash;
  applyTokens();
  render(<App store={store} initialProgress={progress} />);
  return store;
}

afterEach(() => {
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
  window.location.hash = '';
});

describe('album', () => {
  it('shows a waiting sticker and places it with a tap', async () => {
    const store = open('#/treasures', started({ levels: done(['w1-emotions-1']) }));
    const tray = await screen.findByRole('region', { name: 'מדבקות שממתינות להדבקה' });
    fireEvent.click(within(tray).getByRole('button', { name: 'הדבק כאן' }));
    expect(screen.queryByRole('region', { name: 'מדבקות שממתינות להדבקה' })).toBeNull();
    expect(screen.getByText(/1 מתוך \d+ מדבקות נאספו/)).toBeTruthy();
    expect((await store.get<Progress>('progress'))!.album?.placed).toEqual(['w1-emotions-1']);
  });
});

describe('profile', () => {
  it('shows the rank, the streak calendar with its freeze, and certificates', async () => {
    const today = dayKey();
    open(
      '#/profile',
      started({
        xp: 450,
        streak: { days: 3, freezes: 1, lastPlayed: today, played: [today] },
        levels: done([w1.boss.id]),
      }),
    );
    expect(await screen.findByText('חוקר')).toBeTruthy();
    expect(screen.getByText('3 ימים ברצף')).toBeTruthy();
    expect(screen.getByText(/פספסתם יום\? לא נורא/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /לתעודה/ })).toBeTruthy();
    expect(screen.getAllByText('אחרי קרב הבוס')).toHaveLength(3);
  });
});

describe('certificate', () => {
  it('shows the child, the world and both dates, and falls back to download when sharing files is unavailable', async () => {
    const createObjectURL = vi.fn(() => 'blob:cert');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = () => undefined;
    open(
      '#/certificate/1',
      started({ levels: done([w1.boss.id]), settings: { ...initialProgress().settings, childName: 'נועה' } }),
    );
    expect(await screen.findByText('נועה')).toBeTruthy();
    expect(screen.getByText('תעודת גילוי והצטיינות')).toBeTruthy();
    expect(screen.getByText(/נמל היסודות · עולם 1/)).toBeTruthy();
    // jsdom has no navigator.canShare: the image is saved instead.
    fireEvent.click(screen.getByRole('button', { name: 'שתפו עם המשפחה' }));
    expect(await screen.findByText('התעודה נשמרה כתמונה במכשיר.')).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('is only available after the world boss', async () => {
    open('#/certificate/2', started());
    // Redirected to the profile, where the certificate is still locked.
    expect(await screen.findByText('התעודות שלי')).toBeTruthy();
    expect(screen.getAllByText('אחרי קרב הבוס')).toHaveLength(4);
  });
});

describe('duel', () => {
  it('plays both turns on one device and compares the results', async () => {
    open('#/duel', started({ unlockedWorlds: [1, 2] }));
    const inputs = await screen.findAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'איתי' } });
    fireEvent.change(inputs[1]!, { target: { value: 'אבא' } });
    fireEvent.click(screen.getByRole('radio', { name: '5 שאלות' }));
    fireEvent.click(screen.getByRole('button', { name: /התחל דו-קרב/ }));
    for (const name of ['איתי', 'אבא']) {
      expect(screen.getByText(`התור של ${name}`)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /אני מוכן/ }));
      for (let i = 0; i < 5; i++) {
        fireEvent.click(
          within(screen.getByRole('group', { name: 'אפשרויות' })).getAllByRole('button')[name === 'איתי' ? 0 : 1]!,
        );
        fireEvent.click(screen.getByRole('button', { name: /לשאלה הבאה|סיום התור/ }));
      }
    }
    expect(screen.getByText(/הניצחון שייך ל|תיקו/)).toBeTruthy();
    expect(screen.getByText('תשובות נכונות')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'קרב גומלין' })).toBeTruthy();
  });
});

describe('rank up', () => {
  it('celebrates when a boss pass crosses a rank threshold, links the certificate, and marks the streak', async () => {
    const levels = done(
      worldLevels(w1)
        .slice(0, -1)
        .map((l) => l.id),
    );
    const store = open('#/level/w1-boss?seed=1', started({ xp: 280, levels }));
    fireEvent.click(await screen.findByRole('button', { name: 'לקרב!' }));
    for (;;) {
      const prompt = screen.getByText((_, el) => el?.getAttribute('lang') === 'he' && el.tagName === 'P').textContent!;
      const options = within(screen.getByRole('group', { name: 'אפשרויות' })).getAllByRole('button');
      fireEvent.click(options.find((o) => links.areLinked(prompt, o.textContent!.replace(/^\d+/, '')))!);
      const cont = screen.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ });
      const last = cont.textContent === 'סיום הסבב';
      fireEvent.click(cont);
      if (last) break;
    }
    // A pass adds the boss bonus, so 280 XP crosses the 300 threshold of חוקר.
    expect(await screen.findByRole('dialog', { name: 'עליתם לדרגת חוקר' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'המשך בהרפתקה' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('הבוס נוצח!')).toBeTruthy();
    expect(screen.getByRole('link', { name: /פתיחת תעודת ההצטיינות/ })).toBeTruthy();
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.streak.lastPlayed).toBe(dayKey());
    expect(saved.xp).toBeGreaterThanOrEqual(380);
  });
});
