import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import designer from '../src/design/tokens.json';
import { cssVariables, flattenTokens, mergeTokens, motion, tokens } from '../src/design/tokens';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const cssFiles = walk('src').filter((f) => f.endsWith('.css'));

describe('design tokens', () => {
  it('names variables from token paths', () => {
    expect(cssVariables['--wq-colors-base-bg-dark']).toBe(designer.colors.base.bg_dark);
    expect(cssVariables['--wq-typography-scale-word-target-size']).toBe('28px');
    expect(cssVariables['--wq-radii-card']).toBe('20px');
    expect(cssVariables['--wq-theme']).toBeUndefined();
  });

  it('adds order-based world aliases so renamed world keys keep working', () => {
    expect(cssVariables['--wq-world-2-primary']).toBe(designer.colors.worlds.world2_forest.primary);
    const renamed = flattenTokens({
      colors: { worlds: { harbor: { primary: '#000001' }, forest: { primary: '#000002' } } },
    });
    expect(renamed['--wq-world-2-primary']).toBe('#000002');
  });

  it('lets the designer file win over the supplement', () => {
    const merged = mergeTokens({ spacing: { '1': '4px' }, radii: { card: '1px' } }, { radii: { card: '20px' } });
    expect(merged).toEqual({ spacing: { '1': '4px' }, radii: { card: '20px' } });
    expect((tokens.radii as Record<string, string>).card).toBe(designer.radii.card);
  });

  it('defines every --wq variable the stylesheets use (the drop-in contract)', () => {
    const missing: string[] = [];
    for (const file of cssFiles) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--wq-[a-z0-9-]+)\)/g)) {
        if (!(name! in cssVariables)) missing.push(`${file}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('defines every semantic variable components use', () => {
    const theme = readFileSync('src/styles/theme.css', 'utf8');
    const defined = new Set([...theme.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
    const missing: string[] = [];
    for (const file of [...cssFiles, ...walk('src').filter((f) => f.endsWith('.tsx'))]) {
      if (file.endsWith('theme.css')) continue;
      // --local-* properties are set inline on the element (e.g. a ladder rung's position), not theme tokens.
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--(?!wq-|local-)[a-z0-9-]+)\)/g)) {
        if (!defined.has(name!)) missing.push(`${file}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('parses motion tokens in both the v1.1 string form and the v1.0 object form', () => {
    expect(motion('card_snap')).toEqual({ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] });
    expect(motion('feedback_shake')).toEqual({ duration: 0.3, ease: 'easeInOut' });
    expect(motion('xp_count')).toEqual({ duration: 0.6, ease: 'easeOut' });
    expect(() => motion('nope')).toThrow();
  });
});
