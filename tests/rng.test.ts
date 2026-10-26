import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
    expect(createRng('x').shuffle([1, 2, 3, 4, 5])).toEqual(createRng('x').shuffle([1, 2, 3, 4, 5]));
  });

  it('differs between seeds and stays in range', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const n = r.int(5);
      expect(n >= 0 && n < 5).toBe(true);
    }
  });

  it('shuffle keeps every element', () => {
    expect(createRng(3).shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
