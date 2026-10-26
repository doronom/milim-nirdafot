// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { content } from '../src/content';
import { applyTokens } from '../src/design/tokens';
import { buildSynonymLinks } from '../src/engine/links';
import { initialProgress, type Progress } from '../src/engine/progress';

/** A player past the welcome screen. */
const started = (): Progress => ({ ...initialProgress(), onboarded: true });
import { listReports } from '../src/engine/review-queue';
import { memoryStore, type KeyValueStore } from '../src/storage/kv';

const links = buildSynonymLinks(content);

const start = (store: KeyValueStore) => {
  window.location.hash = '#/level/w1-emotions-1?seed=7';
  applyTokens();
  render(<App store={store} initialProgress={started()} />);
};

afterEach(() => {
  // A CSS-module lookup for a state without a rule renders the literal class "undefined".
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
  vi.useRealTimers();
  window.location.hash = '';
});

async function passLearnCards() {
  for (;;) {
    const next = await screen.findByRole('button', { name: /הבנתי/ });
    const last = next.textContent?.includes('בואו נתרגל');
    fireEvent.click(next);
    if (last) return;
  }
}

/** Answers every pick question; `wrongFirst` answers the first one wrong. Returns the wrong option's word. */
async function playPick({ wrongFirst = false, claimAlsoCorrect = false } = {}) {
  let wrongWord: string | undefined;
  for (let q = 0; ; q++) {
    const prompt = (await screen.findByText((_, el) => el?.getAttribute('lang') === 'he' && el.tagName === 'P'))
      .textContent!;
    const options = within(screen.getByRole('group', { name: 'אפשרויות' })).getAllByRole('button');
    const right = options.find((o) => links.areLinked(prompt, o.textContent!.replace(/^\d+/, '')))!;
    if (q === 0 && wrongFirst) {
      const wrong = options.find((o) => o !== right)!;
      wrongWord = wrong.textContent!.replace(/^\d+/, '');
      fireEvent.click(wrong);
      expect(await screen.findByText('כמעט! הנה התשובה')).toBeTruthy();
      if (claimAlsoCorrect) fireEvent.click(screen.getByRole('button', { name: 'גם זו תשובה נכונה!' }));
    } else {
      fireEvent.click(right);
      expect(await screen.findByText('מדויק להפליא!')).toBeTruthy();
    }
    const cont = screen.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ });
    const done = cont.textContent === 'סיום הסבב';
    fireEvent.click(cont);
    if (done) return wrongWord;
  }
}

async function playDrag() {
  for (;;) {
    await screen.findByText('גררו כל מילה אל המילה הנרדפת שלה');
    for (;;) {
      const chips = within(screen.getByRole('group', { name: 'מילים לגרירה' })).queryAllByRole('button');
      if (chips.length === 0) break;
      const chip = chips[0]!;
      const word = chip.textContent!;
      fireEvent.click(chip);
      const targets = within(screen.getByRole('group', { name: 'מילים נרדפות' })).getAllByRole('button');
      fireEvent.click(targets.find((t) => !t.hasAttribute('disabled') && links.areLinked(word, t.textContent!))!);
    }
    const cont = screen.getByRole('button', { name: /ללוח הבא|סיום הסבב/ });
    const done = cont.textContent === 'סיום הסבב';
    fireEvent.click(cont);
    if (done) return;
  }
}

/** Flips unseen cards two at a time to learn the board, then matches the known pairs. */
async function playMemory() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await screen.findByText('מצאו את הזוגות של מילים נרדפות');
  const cards = () => screen.getAllByRole('button', { name: /קלף|.+/ }).filter((b) => b.closest('[class*="grid"]'));
  const words = new Map<number, string>();
  const flip = async (i: number) => {
    fireEvent.click(cards()[i]!);
    words.set(i, cards()[i]!.getAttribute('aria-label')!);
  };
  const total = cards().length;
  for (let i = 0; i < total; i += 2) {
    await flip(i);
    await flip(i + 1);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
  const matched = new Set<number>();
  for (let i = 0; i < total; i++) {
    if (matched.has(i)) continue;
    const j = [...words.keys()].find(
      (k) => k !== i && !matched.has(k) && links.areLinked(words.get(i)!, words.get(k)!),
    );
    if (j === undefined) continue;
    fireEvent.click(cards()[i]!);
    fireEvent.click(cards()[j]!);
    matched.add(i).add(j);
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
  }
  fireEvent.click(await screen.findByRole('button', { name: 'סיום הסבב' }));
  vi.useRealTimers();
}

describe('playing level 1.1', () => {
  it('completes a full level with perfect answers and saves stars and Leitner boxes', async () => {
    const store = memoryStore();
    start(store);
    await passLearnCards();
    await playPick();
    await playDrag();
    await playMemory();
    expect(await screen.findByText(/מושלם!/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /לשלב הבא/ })).toBeTruthy();
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.levels['w1-emotions-1']!.stars).toBe(3);
    expect(Object.keys(saved.leitner)).toHaveLength(7);
    expect(Object.values(saved.leitner).every((c) => c.box === 2)).toBe(true);
    expect(saved.xp).toBeGreaterThan(0);
  });

  it('answers wrong then right: the miss is listed and demoted to box 1', async () => {
    const store = memoryStore();
    start(store);
    await passLearnCards();
    await playPick({ wrongFirst: true });
    await playDrag();
    await playMemory();
    // One miss in about 20 answers is still 90%+, so the stars stay; the word goes back to box 1.
    const practise = await screen.findByRole('region', { name: 'מילים לתרגול' });
    expect(within(practise).getAllByRole('listitem')).toHaveLength(1);
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.levels['w1-emotions-1']!.bestAccuracy).toBeLessThan(1);
    expect(Object.values(saved.leitner).filter((c) => c.box === 1)).toHaveLength(1);
  });

  it('"also correct" queues the pair for review and does not count as a mistake', async () => {
    const store = memoryStore();
    start(store);
    await passLearnCards();
    const word = await playPick({ wrongFirst: true, claimAlsoCorrect: true });
    await playDrag();
    await playMemory();
    expect(await screen.findByText(/מושלם!/)).toBeTruthy();
    const reports = await listReports(store);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ word, status: 'pending', gameId: 'pickSynonym' });
    const saved = (await store.get<Progress>('progress'))!;
    expect(Object.values(saved.leitner).some((c) => c.box === 1)).toBe(false);
  });
});
