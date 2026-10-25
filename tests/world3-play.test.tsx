// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../src/content';
import { applyTokens } from '../src/design/tokens';
import { buildLayout } from '../src/engine/layout';
import { createRng } from '../src/engine/rng';
import { buildContextRound, fitsContext } from '../src/games/contextChoice/build';
import { ContextChoice } from '../src/games/contextChoice/ContextChoice';
import { GameEnvContext } from '../src/games/env-context';
import { createResolver } from '../src/games/items';
import { buildLadderRound } from '../src/games/intensityLadder/build';
import { IntensityLadder } from '../src/games/intensityLadder/IntensityLadder';
import { BIN_LABEL, buildRegisterRound } from '../src/games/registerSort/build';
import { RegisterSort } from '../src/games/registerSort/RegisterSort';
import { buildSwapRound } from '../src/games/swapWord/build';
import { SwapWord } from '../src/games/swapWord/SwapWord';
import type { GameEnv, LevelItem, RoundResult } from '../src/games/types';
import { envFor, pairs, sessionFor } from './helpers';

const env = envFor();
const w3 = buildLayout(content).worlds[2]!;
const resolver = createResolver(content);
const itemsOf = (kind: string): LevelItem[] =>
  w3.stations.find((s) => s.kind === kind)!.levels[0]!.itemIds.map((id) => resolver.byId(id)!);
const difficulty = { tier: 3 as const, options: 3 as const };
const props = { difficulty, onAlsoCorrect: vi.fn(), onReportSentence: vi.fn() };

afterEach(() => {
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
});

function mount(e: GameEnv, el: (onDone: (r: RoundResult) => void) => ReactElement) {
  applyTokens();
  const onDone = vi.fn<(r: RoundResult) => void>();
  render(<GameEnvContext.Provider value={e}>{el(onDone)}</GameEnvContext.Provider>);
  return onDone;
}

describe('IntensityLadder', () => {
  it('fills the rungs weakest first and checks the order', () => {
    const round = buildLadderRound(itemsOf('scales'), difficulty, createRng(1), 'production');
    if (round.mode !== 'order') throw new Error('mode');
    const onDone = mount(env, (done) => <IntensityLadder round={round} stage="production" onDone={done} {...props} />);
    round.questions.forEach((q, i) => {
      const order = i === 0 ? [...q.order].reverse() : q.order;
      for (const w of order)
        fireEvent.click(within(screen.getByRole('group', { name: 'בנק המילים' })).getByRole('button', { name: w }));
      fireEvent.click(screen.getByRole('button', { name: 'בדוק דירוג' }));
      fireEvent.click(screen.getByRole('button', { name: /לסולם הבא|סיום הסבב/ }));
    });
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers.map((a) => a.outcome)).toEqual(round.questions.map((_, i) => (i === 0 ? 'wrong' : 'correct')));
  });
});

describe('RegisterSort', () => {
  it('sorts every word into its bin; a wrong bin marks the set', () => {
    const round = buildRegisterRound(itemsOf('registers'), difficulty, createRng(1), 'discrimination');
    if (round.mode !== 'sort') throw new Error('mode');
    const onDone = mount(env, (done) => <RegisterSort round={round} stage="discrimination" onDone={done} {...props} />);
    round.boards.forEach((board, b) => {
      board.words.forEach((w, i) => {
        const bank = () => within(screen.getByRole('group', { name: 'בנק המילים' }));
        if (b === 0 && i === 0) {
          const wrongBin = (['everyday', 'standard', 'literary'] as const).find(
            (x) => x !== w.bin && !board.emptyBins.includes(x),
          )!;
          fireEvent.click(bank().getByRole('button', { name: w.word }));
          fireEvent.click(screen.getByRole('button', { name: `תא ${BIN_LABEL[wrongBin]}` }));
        }
        fireEvent.click(bank().getByRole('button', { name: w.word }));
        fireEvent.click(screen.getByRole('button', { name: `תא ${BIN_LABEL[w.bin]}` }));
      });
      fireEvent.click(screen.getByRole('button', { name: /לקבוצה הבאה|סיום הסבב/ }));
    });
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers[0]!.outcome).toBe('wrong');
    expect(answers.slice(1).every((a) => a.outcome === 'correct')).toBe(true);
  });
});

describe('ContextChoice', () => {
  it('chooses the fitting word and shows the explanation', () => {
    const round = buildContextRound(itemsOf('contexts'), difficulty, createRng(1), 'recognition');
    const onDone = mount(env, (done) => <ContextChoice round={round} stage="recognition" onDone={done} {...props} />);
    for (const q of round.questions) {
      const right = q.options.find((o) => fitsContext(q.item, o))!;
      fireEvent.click(within(screen.getByRole('group', { name: 'אפשרויות' })).getByRole('button', { name: right }));
      expect(screen.getByText(q.item.context.explanation)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ }));
    }
    expect(onDone.mock.calls[0]![0].answers.every((a) => a.outcome === 'correct')).toBe(true);
  });
});

describe('SwapWord sentence report', () => {
  it('takes the sentence out, skips the question, and records no answer for it', () => {
    const level = buildLayout(content).worlds[1]!.stations[0]!.levels[0]!;
    const items = pairs(sessionFor(level, {}, 'p').items);
    const round = buildSwapRound(env, items, { tier: 2, options: 4 }, createRng(2));
    const onReport = vi.fn();
    const onDone = mount(env, (done) => (
      <SwapWord
        round={round}
        stage="production"
        onDone={done}
        difficulty={difficulty}
        onAlsoCorrect={vi.fn()}
        onReportSentence={onReport}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'דווח על משפט' }));
    expect(onReport).toHaveBeenCalledWith(round.questions[0]!.sentence);
    for (let i = 1; i < round.questions.length; i++)
      fireEvent.click(screen.getByRole('button', { name: 'דווח על משפט' }));
    const answers = onDone.mock.calls[0]![0].answers;
    expect(answers).toEqual([]);
    expect(onReport).toHaveBeenCalledTimes(round.questions.length);
  });
});
