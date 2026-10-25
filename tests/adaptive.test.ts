import { describe, expect, it } from 'vitest';
import { adapt } from '../src/engine/adaptive';

describe('adaptive difficulty', () => {
  it('raises tier and option count at 90% or more', () => {
    expect(adapt({ tier: 1, options: 3 }, 0.9)).toEqual({ next: { tier: 2, options: 4 }, reinsertMissed: false });
    expect(adapt({ tier: 2, options: 4 }, 1).next).toEqual({ tier: 3, options: 5 });
  });

  it('caps at tier 3 and 5 options', () => {
    expect(adapt({ tier: 3, options: 5 }, 1).next).toEqual({ tier: 3, options: 5 });
  });

  it('lowers both below 60% and asks to re-insert the misses', () => {
    expect(adapt({ tier: 3, options: 5 }, 0.59)).toEqual({ next: { tier: 2, options: 4 }, reinsertMissed: true });
    expect(adapt({ tier: 1, options: 3 }, 0).next).toEqual({ tier: 1, options: 3 });
  });

  it('keeps difficulty between 60% and 90%', () => {
    expect(adapt({ tier: 2, options: 4 }, 0.6)).toEqual({ next: { tier: 2, options: 4 }, reinsertMissed: false });
    expect(adapt({ tier: 2, options: 4 }, 0.89).next).toEqual({ tier: 2, options: 4 });
  });
});
