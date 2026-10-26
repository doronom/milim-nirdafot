// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { content } from '../src/content';
import { applyTokens } from '../src/design/tokens';
import { judgeTyped } from '../src/content/typing';
import { buildLayout, worldLevels } from '../src/engine/layout';
import { buildSynonymLinks } from '../src/engine/links';
import { initialProgress, type Progress } from '../src/engine/progress';
import { createRng } from '../src/engine/rng';
import { buildCrosswordRound } from '../src/games/crossword/build';
import { Crossword } from '../src/games/crossword/Crossword';
import { wordCells } from '../src/games/crossword/generate';
import { GameEnvContext } from '../src/games/env-context';
import { buildIdiomRound } from '../src/games/idiomMatch/build';
import { IdiomMatch } from '../src/games/idiomMatch/IdiomMatch';
import { createResolver } from '../src/games/items';
import { buildTypeRound } from '../src/games/typeSynonym/build';
import { TypeSynonym } from '../src/games/typeSynonym/TypeSynonym';
import type { GameEnv, RoundResult } from '../src/games/types';
import { memoryStore } from '../src/storage/kv';
import { envFor, pairs, sessionFor } from './helpers';

const env = envFor();
const links = buildSynonymLinks(content);
const layout = buildLayout(content);
const difficulty = { tier: 3 as const, options: 4 as const };
const props = { difficulty, onAlsoCorrect: vi.fn(), onReportSentence: vi.fn() };
const items = pairs(sessionFor(layout.worlds[0]!.stations[1]!.levels[0]!).items);

afterEach(() => {
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
  window.location.hash = '';
});

function mount(e: GameEnv, el: (onDone: (r: RoundResult) => void) => ReactElement) {
  applyTokens();
  const onDone = vi.fn<(r: RoundResult) => void>();
  render(<GameEnvContext.Provider value={e}>{el(onDone)}</GameEnvContext.Provider>);
  return onDone;
}

const typeWord = (word: string) => {
  const kb = within(screen.getByRole('group', { name: 'מקלדת' }));
  for (const ch of word) {
    if (ch === ' ') fireEvent.click(kb.getByRole('button', { name: 'רווח' }));
    else fireEvent.click(kb.getByRole('button', { name: ch }));
  }
};

describe('TypeSynonym', () => {
  it('accepts an exact answer, nudges a one-letter slip, and rejects a wrong word', () => {
    const round = buildTypeRound(env, items.slice(0, 3), difficulty, createRng(1));
    const onDone = mount(env, (done) => <TypeSynonym round={round} stage="production" onDone={done} {...props} />);
    const [q1, q2] = round.questions;
    typeWord(q1!.item.synonym);
    fireEvent.click(screen.getByRole('button', { name: 'בדיקת תשובה' }));
    expect(screen.getByText('מדויק!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'למילה הבאה' }));
    // A substituted last letter: one edit away, and not itself a word (dropping a letter can make one, e.g. מוארך -> מואר).
    const long = q2!.item.synonym.replace(/\s/g, '').length >= 4;
    const sub = q2!.item.synonym.endsWith('ק') ? 'ש' : 'ק';
    const slip = long ? q2!.item.synonym.slice(0, -1) + sub : q2!.item.synonym;
    expect(judgeTyped(slip, q2!.accepted, round.vocabulary).kind).toBe(long ? 'typo' : 'exact');
    typeWord(slip);
    fireEvent.click(screen.getByRole('button', { name: 'בדיקת תשובה' }));
    expect(screen.getByText(long ? 'כמעט! בדוק את האיות' : 'מדויק!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'למילה הבאה' }));
    typeWord('קקק');
    fireEvent.click(screen.getByRole('button', { name: 'בדיקת תשובה' }));
    expect(screen.getByText('עוד לא. הנה מילים נרדפות')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'סיום הסבב' }));
    // The slip on a 4+ letter word is a near miss: not a mistake, no promotion.
    const slipped = q2!.item.synonym.replace(/\s/g, '').length >= 4 ? 'near-miss' : 'correct';
    expect(onDone.mock.calls[0]![0].answers.map((a) => a.outcome)).toEqual(['correct', slipped, 'wrong']);
  });
});

describe('Crossword', () => {
  it('fills words from the tile bank, checks them, and counts a revealed word as not known', () => {
    const round = buildCrosswordRound(env, items, difficulty, createRng(2));
    const onDone = mount(env, (done) => <Crossword round={round} stage="production" onDone={done} {...props} />);
    const words = round.puzzle.words;
    const filled = new Set<string>();
    words.forEach((w, i) => {
      const clue = within(screen.getByRole('list', { name: 'הגדרות' }))
        .getAllByRole('button')
        .find((b) => b.textContent?.endsWith(w.clue))!;
      fireEvent.click(clue);
      if (i === 0) fireEvent.click(screen.getByRole('button', { name: 'גלה מילה' }));
      else {
        // Cells shared with a solved word are already filled; type the rest from the tiles.
        for (const cell of wordCells(w).filter((c) => !filled.has(`${c.row}:${c.col}`))) {
          fireEvent.click(
            within(screen.getByRole('group', { name: 'אריחי אותיות' })).getAllByRole('button', { name: cell.ch })[0]!,
          );
        }
        fireEvent.click(screen.getByRole('button', { name: 'בדוק מילה' }));
      }
      for (const c of wordCells(w)) filled.add(`${c.row}:${c.col}`);
    });
    fireEvent.click(screen.getByRole('button', { name: 'סיום הסבב' }));
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers.find((a) => a.itemKey === words[0]!.itemKey)?.outcome).toBe('wrong');
    expect(answers.filter((a) => a.outcome === 'correct')).toHaveLength(words.length - 1);
  });
});

describe('IdiomMatch', () => {
  it('matches an idiom to its meaning, then plays the bonus fill-in without scoring it', () => {
    const resolver = createResolver(content);
    const round = buildIdiomRound(
      env,
      content.idioms.slice(0, 2).map((i) => resolver.byId(i.id)!),
      difficulty,
      createRng(3),
      'recognition',
    );
    const onDone = mount(env, (done) => <IdiomMatch round={round} stage="recognition" onDone={done} {...props} />);
    for (const q of round.questions) {
      fireEvent.click(within(screen.getByRole('group', { name: 'אפשרויות' })).getByRole('button', { name: q.answer }));
      fireEvent.click(screen.getByRole('button', { name: 'לשלב הבונוס' }));
      const wrongFill = q.fill.options.find((o) => o !== q.fill.answer)!;
      fireEvent.click(
        within(screen.getByRole('group', { name: 'אפשרויות לבונוס' })).getByRole('button', { name: wrongFill }),
      );
      fireEvent.click(screen.getByRole('button', { name: /לביטוי הבא|סיום הסבב/ }));
    }
    expect(onDone.mock.calls[0]![0].answers.map((a) => a.outcome)).toEqual(['correct', 'correct']);
  });
});

describe('app flows', () => {
  const w1 = layout.worlds[0]!;
  const allButBoss = (): Progress => ({
    ...initialProgress(),
    onboarded: true,
    levels: Object.fromEntries(
      worldLevels(w1)
        .slice(0, -1)
        .map((l) => [l.id, { stars: 3, bestAccuracy: 1, completedAt: 'x' }]),
    ),
  });

  async function playBoss(rightCount: number) {
    fireEvent.click(await screen.findByRole('button', { name: 'לקרב!' }));
    let answered = 0;
    for (;;) {
      const prompt = (await screen.findByText((_, el) => el?.getAttribute('lang') === 'he' && el.tagName === 'P'))
        .textContent!;
      const options = within(screen.getByRole('group', { name: 'אפשרויות' })).getAllByRole('button');
      const right = options.find((o) => links.areLinked(prompt, o.textContent!.replace(/^\d+/, '')))!;
      fireEvent.click(answered < rightCount ? right : options.find((o) => o !== right)!);
      answered += 1;
      const cont = screen.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ });
      const done = cont.textContent === 'סיום הסבב';
      fireEvent.click(cont);
      if (done) return;
    }
  }

  it('a boss pass opens the next world', async () => {
    const store = memoryStore();
    window.location.hash = '#/level/w1-boss?seed=1';
    applyTokens();
    render(<App store={store} initialProgress={allButBoss()} />);
    await playBoss(13);
    expect(await screen.findByText('הבוס נוצח!')).toBeTruthy();
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.unlockedWorlds).toContain(2);
    expect(saved.levels['w1-boss']?.stars).toBeGreaterThan(0);
  });

  it('a boss fail lists words to practise and changes nothing on the path', async () => {
    const store = memoryStore();
    window.location.hash = '#/level/w1-boss?seed=1';
    applyTokens();
    const start = allButBoss();
    render(<App store={store} initialProgress={start} />);
    await playBoss(9);
    expect(await screen.findByText('כמעט שם!')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'מילים לתרגול' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'לנסות שוב' })).toBeTruthy();
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.unlockedWorlds).toEqual([1]);
    expect(saved.levels).toEqual(start.levels);
  });

  it('a new player lands on the welcome screen and can start at the harbor', async () => {
    const store = memoryStore();
    window.location.hash = '#/';
    applyTokens();
    render(<App store={store} initialProgress={initialProgress()} />);
    expect(await screen.findByText('ברוכים הבאים למסע המילים!')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'נועה' } });
    fireEvent.click(screen.getByRole('button', { name: /מתחילים מנמל היסודות/ }));
    expect(await screen.findByText('מסע המילים')).toBeTruthy();
    const saved = (await store.get<Progress>('progress'))!;
    expect(saved.onboarded).toBe(true);
    expect(saved.settings.childName).toBe('נועה');
  });
});
