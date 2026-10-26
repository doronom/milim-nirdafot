// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { applyTokens } from '../src/design/tokens';
import { initialProgress, type Progress } from '../src/engine/progress';

/** A player past the welcome screen. */
const started = (): Progress => ({ ...initialProgress(), onboarded: true });
import { memoryStore } from '../src/storage/kv';

const renderAt = (hash: string, progress: Progress = started()) => {
  window.location.hash = hash;
  applyTokens();
  return render(<App store={memoryStore()} initialProgress={progress} />);
};

afterEach(() => {
  // A CSS-module lookup for a state without a rule renders the literal class "undefined".
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  cleanup();
  window.location.hash = '';
});

describe('world map', () => {
  it('shows the four worlds with only the harbor open', async () => {
    renderAt('#/');
    const worlds = await screen.findAllByRole('article');
    expect(worlds).toHaveLength(4);
    expect(worlds[0]!.getAttribute('aria-label')).toBe('נמל היסודות, פעיל עכשיו');
    expect(worlds[1]!.getAttribute('aria-label')).toBe('יער ההרחבה, השלב הבא');
    expect(worlds[3]!.getAttribute('aria-label')).toBe('מגדל המומחים, נעול');
    expect(within(worlds[0]!).getByRole('link', { name: /התחל במסע/ })).toBeTruthy();
    expect(within(worlds[1]!).getByText(/נפתח עם סיום נמל היסודות/)).toBeTruthy();
    expect(within(worlds[1]!).queryByRole('link')).toBeNull();
  });

  it('opens the station path for world 1', async () => {
    renderAt('#/');
    fireEvent.click(await screen.findByRole('link', { name: /התחל במסע/ }));
    expect(await screen.findByText('תחנה 1: רגשות ותחושות')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'התחל שלב 1.1: היכרות' })).toBeTruthy();
    expect(screen.getByLabelText('שלב 1.2: אתגר, נעול')).toBeTruthy();
  });
});

describe('station path', () => {
  it('marks done levels and moves the current level forward', async () => {
    const progress: Progress = {
      ...started(),
      levels: { 'w1-emotions-1': { stars: 3, bestAccuracy: 1, completedAt: '2026-10-25' } },
    };
    renderAt('#/world/1', progress);
    expect(await screen.findByRole('link', { name: 'שלב 1.1: היכרות, הושלם' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'התחל שלב 1.2: אתגר' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /שחק עכשיו · שלב 1.2/ })).toBeTruthy();
  });

  it('redirects a locked world back to the map', async () => {
    renderAt('#/world/3');
    expect(await screen.findByText('מסע המילים')).toBeTruthy();
  });

  it('opens a level and lists its words', async () => {
    renderAt('#/level/w1-emotions-1');
    expect(await screen.findByText('שלב 1.1: היכרות')).toBeTruthy();
    expect(screen.getByText('אהבה')).toBeTruthy();
  });
});
