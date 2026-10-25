import { normalizeWord } from '../../content/text';
import type { Rng } from '../../engine/rng';

/** Right-to-left along a row (increasing column, rendered RTL), or top-down along a column. As in the booklet. */
export type Direction = 'rtl' | 'down';

export interface Cell {
  row: number;
  col: number;
}

export interface WordInput {
  /** The word as shown in the list (may contain a space, e.g. "שקט נפשי"). */
  word: string;
  itemKey: string;
}

export interface PlacedWord extends WordInput {
  /** Letters as laid in the grid: no spaces, maqaf or niqqud. */
  letters: string;
  direction: Direction;
  cells: Cell[];
}

export interface WordSearchGrid {
  size: number;
  rows: string[][];
  words: PlacedWord[];
}

/** Letters as they go into the grid: multi-word phrases run together ("שקטנפשי"). */
export const gridLetters = (word: string): string => normalizeWord(word).replace(/[\s־]/g, '');

/**
 * Approximate Hebrew letter frequencies (percent) for the filler, so the grid looks like real text rather than noise.
 * Final forms are left out of the filler.
 */
const LETTER_FREQUENCY: [string, number][] = [
  ['י', 11.1],
  ['ו', 10.5],
  ['ה', 8.7],
  ['ל', 7],
  ['א', 6.3],
  ['מ', 5.9],
  ['ר', 5.6],
  ['ת', 5],
  ['ב', 4.8],
  ['ש', 4.4],
  ['נ', 4],
  ['ד', 2.7],
  ['כ', 2.6],
  ['ע', 2.5],
  ['ח', 2.3],
  ['ק', 1.9],
  ['פ', 1.8],
  ['ס', 1.5],
  ['ג', 1.3],
  ['ט', 1.3],
  ['ז', 0.9],
  ['צ', 0.8],
];
const TOTAL = LETTER_FREQUENCY.reduce((s, [, f]) => s + f, 0);

function fillerLetter(rng: Rng): string {
  let x = rng.next() * TOTAL;
  for (const [letter, f] of LETTER_FREQUENCY) {
    x -= f;
    if (x < 0) return letter;
  }
  return 'י';
}

export const cellsFor = (start: Cell, direction: Direction, length: number): Cell[] =>
  Array.from({ length }, (_, i) =>
    direction === 'rtl' ? { row: start.row, col: start.col + i } : { row: start.row + i, col: start.col },
  );

const ATTEMPTS = 60;

/**
 * Places every word (longest first) at a random fitting spot; words may cross where letters agree. Restarts with a
 * new layout if a word cannot fit, and throws if no layout is found, so callers pass words that fit the grid.
 * Deterministic for a given rng.
 */
export function generateWordSearch(inputs: readonly WordInput[], rng: Rng, size = 10): WordSearchGrid {
  const words = [...inputs]
    .map((w) => ({ ...w, letters: gridLetters(w.word) }))
    .sort((a, b) => b.letters.length - a.letters.length || a.letters.localeCompare(b.letters));
  for (const w of words) {
    if (w.letters.length > size) throw new Error(`"${w.word}" is longer than the grid`);
  }
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rows: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    const placed: PlacedWord[] = [];
    let failed = false;
    for (const w of words) {
      const spots: { start: Cell; direction: Direction }[] = [];
      for (const direction of ['rtl', 'down'] as const) {
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const cells = cellsFor({ row, col }, direction, w.letters.length);
            const free = cells.every(
              (c, i) => c.row < size && c.col < size && (rows[c.row]![c.col] ?? w.letters[i]) === w.letters[i],
            );
            if (free) {
              spots.push({ start: { row, col }, direction });
            }
          }
        }
      }
      if (spots.length === 0) {
        failed = true;
        break;
      }
      const { start, direction } = rng.pick(spots);
      const cells = cellsFor(start, direction, w.letters.length);
      cells.forEach((c, i) => (rows[c.row]![c.col] = w.letters[i]!));
      placed.push({ word: w.word, itemKey: w.itemKey, letters: w.letters, direction, cells });
    }
    if (failed) continue;
    return { size, rows: rows.map((r) => r.map((ch) => ch ?? fillerLetter(rng))), words: placed };
  }
  throw new Error('could not lay out the word search');
}

/** The straight selection from a to b, if it runs right-to-left along a row or top-down along a column. */
export function selectionCells(a: Cell, b: Cell): Cell[] | null {
  if (a.row === b.row && b.col >= a.col) return cellsFor(a, 'rtl', b.col - a.col + 1);
  if (a.col === b.col && b.row >= a.row) return cellsFor(a, 'down', b.row - a.row + 1);
  return null;
}

/** The not-yet-found word a selection spells, judged by its letters so an accidental duplicate also counts. */
export function matchSelection(grid: WordSearchGrid, cells: Cell[], found: ReadonlySet<string>): PlacedWord | null {
  const text = cells.map((c) => grid.rows[c.row]![c.col]).join('');
  return grid.words.find((w) => !found.has(w.itemKey) && w.letters === text) ?? null;
}
