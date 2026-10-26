import type { Rng } from '../../engine/rng';

/** Across runs right to left (increasing column, rendered RTL); down runs top to bottom. */
export type CrossDirection = 'across' | 'down';

export interface CrossInput {
  /** The letters to place, exactly as they appear in the grid (no spaces). */
  answer: string;
  clue: string;
  itemKey: string;
}

export interface CrossWord extends CrossInput {
  row: number;
  col: number;
  direction: CrossDirection;
  /** Clue number, in reading order of the start cells. */
  number: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  /** Letters by cell; null for blocked cells. */
  cells: (string | null)[][];
  words: CrossWord[];
}

export const CROSS_MIN = 5;
export const CROSS_MAX = 7;

type Placed = Omit<CrossWord, 'number'>;

const step = (d: CrossDirection) => (d === 'across' ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 });
const cellsOf = (w: { row: number; col: number; direction: CrossDirection; answer: string }) => {
  const { dr, dc } = step(w.direction);
  return [...w.answer].map((ch, i) => ({ row: w.row + dr * i, col: w.col + dc * i, ch }));
};

/** Checks a placement against the board: letters agree at crossings and no word touches another side by side. */
function fits(board: Map<string, string>, p: Placed): { ok: boolean; crossings: number } {
  const { dr, dc } = step(p.direction);
  const at = (r: number, c: number) => board.get(`${r}:${c}`);
  // The cells just before and after the word must be free, so words do not run into each other.
  if (at(p.row - dr, p.col - dc) || at(p.row + dr * p.answer.length, p.col + dc * p.answer.length))
    return { ok: false, crossings: 0 };
  let crossings = 0;
  for (const { row, col, ch } of cellsOf(p)) {
    const existing = at(row, col);
    if (existing) {
      if (existing !== ch) return { ok: false, crossings: 0 };
      crossings += 1;
      continue;
    }
    // A new cell may not sit beside another word's letter (that would form a two-letter non-word).
    const side = p.direction === 'across' ? [at(row - 1, col), at(row + 1, col)] : [at(row, col - 1), at(row, col + 1)];
    if (side.some(Boolean)) return { ok: false, crossings: 0 };
  }
  return { ok: crossings < p.answer.length, crossings };
}

function bounds(cells: { row: number; col: number }[]) {
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  return { r0: Math.min(...rows), r1: Math.max(...rows), c0: Math.min(...cols), c1: Math.max(...cols) };
}

/**
 * Builds a 5x5 to 7x7 crossword from as many inputs as fit (longest first). Every later word must cross an earlier
 * one. Words that cannot be placed are left out; every word returned is on the grid. Deterministic for a given rng.
 */
export function generateCrossword(inputs: readonly CrossInput[], rng: Rng): Crossword {
  const words = [...inputs]
    .filter((w) => w.answer.length >= 2 && w.answer.length <= CROSS_MAX)
    .sort((a, b) => b.answer.length - a.answer.length || a.answer.localeCompare(b.answer));
  if (words.length === 0) throw new Error('no words fit a crossword');
  const board = new Map<string, string>();
  const placed: Placed[] = [];
  const put = (p: Placed) => {
    placed.push(p);
    for (const { row, col, ch } of cellsOf(p)) board.set(`${row}:${col}`, ch);
  };
  put({ ...words[0]!, row: 0, col: 0, direction: rng.next() < 0.5 ? 'across' : 'down' });

  for (const w of words.slice(1)) {
    const options: { p: Placed; crossings: number }[] = [];
    for (const anchor of placed) {
      const direction: CrossDirection = anchor.direction === 'across' ? 'down' : 'across';
      const { dr, dc } = step(direction);
      for (const cell of cellsOf(anchor)) {
        [...w.answer].forEach((ch, i) => {
          if (ch !== cell.ch) return;
          const p: Placed = { ...w, row: cell.row - dr * i, col: cell.col - dc * i, direction };
          const { ok, crossings } = fits(board, p);
          if (!ok) return;
          const box = bounds(
            [...board.keys()]
              .map((k) => ({ row: Number(k.split(':')[0]), col: Number(k.split(':')[1]) }))
              .concat(cellsOf(p)),
          );
          if (box.r1 - box.r0 + 1 <= CROSS_MAX && box.c1 - box.c0 + 1 <= CROSS_MAX) options.push({ p, crossings });
        });
      }
    }
    if (options.length === 0) continue;
    const most = Math.max(...options.map((o) => o.crossings));
    put(rng.pick(options.filter((o) => o.crossings === most)).p);
  }

  const box = bounds(placed.flatMap(cellsOf));
  const height = box.r1 - box.r0 + 1;
  const width = box.c1 - box.c0 + 1;
  const size = Math.max(CROSS_MIN, height, width);
  // Centre the words in a square grid of at least 5x5.
  const offR = Math.floor((size - height) / 2) - box.r0;
  const offC = Math.floor((size - width) / 2) - box.c0;
  const shifted = placed.map((p) => ({ ...p, row: p.row + offR, col: p.col + offC }));
  const cells: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  for (const p of shifted) for (const { row, col, ch } of cellsOf(p)) cells[row]![col] = ch;

  const starts = [...new Set(shifted.map((p) => `${p.row}:${p.col}`))].sort((a, b) => {
    const [ar, ac] = a.split(':').map(Number) as [number, number];
    const [br, bc] = b.split(':').map(Number) as [number, number];
    return ar - br || ac - bc;
  });
  const numbered = shifted.map((p) => ({ ...p, number: starts.indexOf(`${p.row}:${p.col}`) + 1 }));
  return {
    rows: size,
    cols: size,
    cells,
    words: numbered.sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1)),
  };
}

export const wordCells = (w: Pick<CrossWord, 'row' | 'col' | 'direction' | 'answer'>) => cellsOf(w);
