// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildContent, content, sources } from '../src/content';
import { createDisplayWord } from '../src/content/display';
import type { Content } from '../src/content/types';
import { applyTokens } from '../src/design/tokens';
import { buildSynonymGraph } from '../src/engine/graph';
import { buildLayout } from '../src/engine/layout';
import { buildSynonymLinks } from '../src/engine/links';
import { createRng } from '../src/engine/rng';
import { GameEnvContext } from '../src/games/env-context';
import { buildOddRound } from '../src/games/oddOneOut/build';
import { OddOneOut } from '../src/games/oddOneOut/OddOneOut';
import { buildLevelSession } from '../src/games/session';
import { buildSwapRound, fitsSentence } from '../src/games/swapWord/build';
import { SwapWord } from '../src/games/swapWord/SwapWord';
import type { GameEnv, RoundResult } from '../src/games/types';
import { buildWordSearchRound } from '../src/games/wordSearch/build';
import { WordSearch } from '../src/games/wordSearch/WordSearch';

const envFor = (c: Content): GameEnv => ({
  content: c,
  graph: buildSynonymGraph(c),
  links: buildSynonymLinks(c),
  pool: c.entries,
  decisions: {},
  displayWord: createDisplayWord(c),
});
const difficulty = { tier: 2 as const, options: 4 as const };
const level = buildLayout(content).worlds[1]!.stations[0]!.levels[0]!;
const items = buildLevelSession(level, content, {}, 'p').items;

afterEach(() => {
  // A CSS-module lookup for a state without a rule renders the literal class "undefined".
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
});

function mount(env: GameEnv, el: (onDone: (r: RoundResult) => void) => React.ReactElement) {
  applyTokens();
  const onDone = vi.fn<(r: RoundResult) => void>();
  render(<GameEnvContext.Provider value={env}>{el(onDone)}</GameEnvContext.Provider>);
  return onDone;
}

describe('OddOneOut', () => {
  it('pops intruders to the end, with one wrong pop recorded', () => {
    const env = envFor(content);
    const round = buildOddRound(env, items, difficulty, createRng(1));
    const onAlso = vi.fn();
    const onDone = mount(env, (done) => (
      <OddOneOut round={round} difficulty={difficulty} onDone={done} onAlsoCorrect={onAlso} />
    ));
    round.questions.forEach((q, i) => {
      const field = screen.getByRole('group', { name: 'בועות' });
      const target = i === 0 ? q.bubbles.find((b) => !b.intruder)! : q.bubbles.find((b) => b.intruder)!;
      fireEvent.click(within(field).getByRole('button', { name: env.displayWord(target.word) }));
      fireEvent.click(screen.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ }));
    });
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers).toHaveLength(round.questions.length);
    expect(answers.filter((a) => a.outcome === 'wrong')).toHaveLength(1);
  });
});

describe('SwapWord', () => {
  it('places a fitting word in the slot and checks it', () => {
    const reviewed = buildContent({
      ...sources,
      sentences: {
        ...sources.sentences,
        sentences: sources.sentences.sentences.map((s) => ({ ...s, reviewed: true })),
      },
    });
    const env = envFor(reviewed);
    const round = buildSwapRound(env, items, difficulty, createRng(2));
    const onDone = mount(env, (done) => (
      <SwapWord round={round} difficulty={difficulty} onDone={done} onAlsoCorrect={vi.fn()} />
    ));
    for (const q of round.questions) {
      const right = q.options.find((o) => fitsSentence(q, o.word))!;
      fireEvent.click(
        within(screen.getByRole('group', { name: 'בנק המילים' })).getByRole('button', {
          name: env.displayWord(right.word),
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'בדוק החלפה' }));
      expect(screen.getByText('החלפה מדויקת!')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /למשפט הבא|סיום הסבב/ }));
    }
    expect(onDone.mock.calls[0]![0].answers.every((a) => a.outcome === 'correct')).toBe(true);
  });
});

describe('WordSearch', () => {
  it('finds words by tapping the first and last letter, and counts a revealed word as not known', () => {
    const env = envFor(content);
    const round = buildWordSearchRound(env, items, difficulty, createRng(3));
    const onDone = mount(env, (done) => (
      <WordSearch round={round} difficulty={difficulty} onDone={done} onAlsoCorrect={vi.fn()} />
    ));
    const grid = screen.getByRole('grid', { name: 'לוח התפזורת' });
    const cell = (r: number, c: number) => grid.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`)!;
    // jsdom has no layout, so point elementFromPoint at the cell being "touched".
    let touched: HTMLElement | null = null;
    document.elementFromPoint = () => touched;
    const tap = (r: number, c: number) => {
      touched = cell(r, c);
      fireEvent.pointerDown(grid, { pointerId: 1 });
      fireEvent.pointerUp(grid, { pointerId: 1 });
    };
    const [first, ...rest] = round.grid.words;
    for (const w of rest) {
      tap(w.cells[0]!.row, w.cells[0]!.col);
      tap(w.cells.at(-1)!.row, w.cells.at(-1)!.col);
    }
    fireEvent.click(screen.getByRole('button', { name: 'הראו לי מילה אחת' }));
    fireEvent.click(screen.getByRole('button', { name: 'סיום הסבב' }));
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers.filter((a) => a.outcome === 'correct')).toHaveLength(rest.length);
    expect(answers.find((a) => a.itemKey === first!.itemKey)?.outcome).toBe('wrong');
  });
});
