// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { watchLayout } from '../src/design/layout';
import { tokens } from '../src/design/tokens';

/** A window whose one media query can be flipped, like turning the phone. */
function fakeWindow() {
  let matches = false;
  let listener: (() => void) | undefined;
  const queries: string[] = [];
  const win = {
    document,
    matchMedia: (q: string) => {
      queries.push(q);
      return {
        get matches() {
          return matches;
        },
        addEventListener: (_: string, l: () => void) => (listener = l),
      };
    },
  } as unknown as Window;
  return { win, queries, turn: (landscape: boolean) => ((matches = landscape), listener?.()) };
}

describe('landscape layout', () => {
  it('marks the page while the phone is on its side, from the size token, and clears it when turned back', () => {
    const { win, queries, turn } = fakeWindow();
    watchLayout(win);
    expect(queries[0]).toBe(
      `(orientation: landscape) and (max-height: ${(tokens.layout as Record<string, string>).landscape_max_height})`,
    );
    expect(document.documentElement.dataset.layout).toBeUndefined();
    turn(true);
    expect(document.documentElement.dataset.layout).toBe('landscape');
    turn(false);
    expect(document.documentElement.dataset.layout).toBeUndefined();
  });

  it('lets the installed app rotate', async () => {
    const config = (await import('node:fs')).readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("orientation: 'any'");
  });
});
