import { describe, expect, it } from 'vitest';
import { clipTexts } from '../src/audio/clips';
import { clipUrl } from '../src/audio/player';
import { content } from '../src/content';
import manifest from '../src/generated/audio-manifest.json';

describe('audio clips', () => {
  const texts = clipTexts(content);

  it('lists every spoken word and sentence once', () => {
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toContain('גדול');
    expect(texts).toContain('ראינו בגן החיות פיל גדול.');
    expect(texts).toContain(content.idioms[0]!.example);
  });

  it('has a committed clip for every text, recorded with the chosen voice', () => {
    const clips = (manifest as { voice: string | null; clips: Record<string, string> }).clips;
    expect(manifest.voice).toBe('he-IL-Chirp3-HD-Aoede');
    expect(texts.filter((t) => !clips[t])).toEqual([]);
  });

  it('finds a clip by exact text, or by the bare spelling of a pointed word, and none for edited text', () => {
    expect(clipUrl('גדול')).toMatch(/audio\/[0-9a-f]{16}\.mp3$/);
    expect(clipUrl('רֵעַ')).toMatch(/\.mp3$/);
    expect(clipUrl('גדולללל')).toBeUndefined();
  });
});
