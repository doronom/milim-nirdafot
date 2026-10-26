import { describe, expect, it } from 'vitest';
import { editDistance, judgeTyped, normalizeTyped, typedVocabulary } from '../src/content/typing';
import { content } from '../src/content';
import { createRng } from '../src/engine/rng';
import { generateCrossword, wordCells } from '../src/games/crossword/generate';

describe('typed answers', () => {
  it('normalizes final letters, niqqud, maqaf and spaces', () => {
    expect(normalizeTyped('גלמוד')).toBe(normalizeTyped('גלמוד'));
    expect(normalizeTyped('שלום')).toBe('שלומ');
    expect(normalizeTyped('ענק')).toBe(normalizeTyped('ענק'));
    expect(normalizeTyped('קצרן')).toBe('קצרנ');
    expect(normalizeTyped('רֵעַ')).toBe('רע');
    expect(normalizeTyped('  שקט   נפשי ')).toBe('שקט נפשי');
    expect(normalizeTyped('למד מ־')).toBe('למד מ');
    expect(['ך', 'ם', 'ן', 'ף', 'ץ'].map(normalizeTyped)).toEqual(['כ', 'מ', 'נ', 'פ', 'צ']);
  });

  it('measures edit distance', () => {
    expect(editDistance('סקרן', 'סקרן')).toBe(0);
    expect(editDistance('מתעניין', 'מתאניין')).toBe(1);
    expect(editDistance('מתעניין', 'מתענין')).toBe(1);
    expect(editDistance('אבג', 'גבא')).toBe(2);
    expect(editDistance('', 'אב')).toBe(2);
  });

  it('accepts exact answers, accepts one-letter slips with a nudge, rejects the rest', () => {
    const accepted = ['מתעניין', 'צמא דעת'];
    expect(judgeTyped('מתעניין', accepted)).toEqual({ kind: 'exact', word: 'מתעניין' });
    expect(judgeTyped('מתאניין', accepted)).toEqual({ kind: 'typo', word: 'מתעניין' });
    expect(judgeTyped('צמא  דעת', accepted)).toEqual({ kind: 'exact', word: 'צמא דעת' });
    expect(judgeTyped('שמח', accepted)).toEqual({ kind: 'wrong' });
    expect(judgeTyped('', accepted)).toEqual({ kind: 'wrong' });
    // No typo tolerance on very short words, where one letter changes the word.
    expect(judgeTyped('אח', ['אב'])).toEqual({ kind: 'wrong' });
  });

  it('tolerates slips only on answers of 4 letters or more', () => {
    expect(judgeTyped('תשש', ['תשוש']).kind).toBe('typo');
    expect(judgeTyped('גם', ['גמע']).kind).toBe('wrong');
    expect(judgeTyped('נע', ['נעם']).kind).toBe('wrong');
    expect(judgeTyped('לגם', ['לגמע']).kind).toBe('typo');
  });

  it('never treats a real word from the data as a slip of the answer', () => {
    const vocabulary = typedVocabulary(content.entries.flatMap((e) => [e.headword, ...e.synonyms]));
    // רחוק (far) and רחוב (street) are one letter apart and both in the data.
    expect(vocabulary.has(normalizeTyped('רחוב'))).toBe(true);
    expect(judgeTyped('רחוב', ['רחוק'], vocabulary)).toEqual({ kind: 'wrong' });
    expect(judgeTyped('רחוב', ['רחוק']).kind).toBe('typo');
    // Dropping a letter can also land on a word: מוארך -> מואר.
    expect(judgeTyped('מואר', ['מוארך'], vocabulary)).toEqual({ kind: 'wrong' });
    expect(judgeTyped('מוארק', ['מוארך'], vocabulary).kind).toBe('typo');
    expect(judgeTyped('מוארכ', ['מוארך'], vocabulary).kind).toBe('exact');
  });

  it('treats a final letter typed mid-word or a regular letter typed at the end as the same', () => {
    expect(judgeTyped('גלמוד', ['גלמוד']).kind).toBe('exact');
    expect(judgeTyped('שליט', ['שליט']).kind).toBe('exact');
    expect(judgeTyped('מזונ', ['מזון']).kind).toBe('exact');
  });
});

describe('crossword generator', () => {
  const inputs = [
    { answer: 'עצום', clue: 'מילה נרדפת ל־גדול', itemKey: 'a' },
    { answer: 'גיבור', clue: 'מילה נרדפת ל־אמיץ', itemKey: 'b' },
    { answer: 'זעיר', clue: 'מילה נרדפת ל־קטן', itemKey: 'c' },
    { answer: 'עליז', clue: 'מילה נרדפת ל־שמח', itemKey: 'd' },
    { answer: 'רגוע', clue: 'מילה נרדפת ל־שליו', itemKey: 'e' },
    { answer: 'מהיר', clue: 'מילה נרדפת ל־זריז', itemKey: 'f' },
  ];

  it('places words consistently in a 5x5 to 7x7 grid, deterministically', () => {
    for (let seed = 0; seed < 30; seed++) {
      const cw = generateCrossword(inputs, createRng(seed));
      expect(cw.rows).toBeGreaterThanOrEqual(5);
      expect(cw.rows).toBeLessThanOrEqual(7);
      expect(cw.cols).toBe(cw.rows);
      expect(cw.words.length).toBeGreaterThanOrEqual(3);
      const owners = new Map<string, number>();
      for (const w of cw.words) {
        for (const { row, col, ch } of wordCells(w)) {
          expect(row >= 0 && row < cw.rows && col >= 0 && col < cw.cols).toBe(true);
          expect(cw.cells[row]![col]).toBe(ch);
          owners.set(`${row}:${col}`, (owners.get(`${row}:${col}`) ?? 0) + 1);
        }
      }
      // Every filled cell belongs to a word; crossings belong to exactly two.
      for (let r = 0; r < cw.rows; r++)
        for (let c = 0; c < cw.cols; c++) {
          const n = owners.get(`${r}:${c}`) ?? 0;
          expect(cw.cells[r]![c] === null).toBe(n === 0);
          expect(n).toBeLessThanOrEqual(2);
        }
      // All words connect: every word after the first crosses another.
      for (const w of cw.words.slice(1)) {
        expect(wordCells(w).some(({ row, col }) => owners.get(`${row}:${col}`) === 2)).toBe(true);
      }
      expect(generateCrossword(inputs, createRng(seed))).toEqual(cw);
    }
  });

  it('numbers clues in reading order and keeps across and down', () => {
    const cw = generateCrossword(inputs, createRng(4));
    const numbers = cw.words.map((w) => w.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(cw.words.map((w) => w.direction))).toEqual(new Set(['across', 'down']));
  });

  it('never lets two words touch side by side', () => {
    for (let seed = 0; seed < 30; seed++) {
      const cw = generateCrossword(inputs, createRng(seed));
      for (const w of cw.words) {
        const cells = wordCells(w);
        const before = w.direction === 'across' ? cw.cells[w.row]?.[w.col - 1] : cw.cells[w.row - 1]?.[w.col];
        const last = cells.at(-1)!;
        const after =
          w.direction === 'across' ? cw.cells[last.row]?.[last.col + 1] : cw.cells[last.row + 1]?.[last.col];
        expect(before ?? null).toBeNull();
        expect(after ?? null).toBeNull();
      }
    }
  });
});
