import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { createDisplayWord, createItemLabel } from '../src/content/display';

describe('display words', () => {
  const display = createDisplayWord(content);

  it('drops niqqud by default', () => {
    expect(display('שָׁלוֹם')).toBe('שלום');
  });

  it('keeps niqqud when the bare spelling is another word (רֵעַ vs רע)', () => {
    expect(display('רֵעַ')).toBe('רֵעַ');
  });

  it('labels level items of every kind', () => {
    const label = createItemLabel(content);
    expect(label('b001')).toBe('אהבה');
    expect(label('scale01')).toBe('טמפרטורה – חום');
    expect(label('idiom01')).toBe('קשה עורף');
  });
});
