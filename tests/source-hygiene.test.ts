import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../src/ui/icons';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const uiFiles = [...walk('src/ui'), ...walk('src/screens')].filter((f) => /\.(css|tsx)$/.test(f));

const offenders = (files: string[], re: RegExp) =>
  files.flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => re.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .map(({ line, i }) => `${f}:${i + 1}: ${line.trim()}`),
  );

describe('source hygiene', () => {
  it('takes colors, sizes and durations from tokens, never literals', () => {
    expect(offenders(uiFiles, /#[0-9a-fA-F]{3,8}\b|rgba?\(|\b\d+(\.\d+)?(px|ms|rem|em)\b/)).toEqual([]);
  });

  it('uses logical CSS properties only', () => {
    const physical =
      /\b(margin|padding|border)-(left|right|top|bottom)\b|(^|[\s{;])(left|right|top|bottom)\s*:|text-align:\s*(left|right)|(^|[\s{;])(width|height|min-width|max-width|min-height|max-height)\s*:|float:\s*(left|right)/;
    const css = walk('src').filter((f) => f.endsWith('.css'));
    expect(offenders(css, physical)).toEqual([]);
  });

  it('has no emoji in code or config files', () => {
    const files = [
      ...walk('src').filter((f) => /\.(ts|tsx|css|json)$/.test(f)),
      ...walk('scripts'),
      ...walk('tests'),
      ...['package.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'index.html'],
    ];
    expect(offenders(files, /\p{Extended_Pictographic}/u)).toEqual([]);
  });

  it('ships an SVG for every icon name', () => {
    expect(ICON_NAMES.filter((n) => !existsSync(`src/design/icons/${n}.svg`))).toEqual([]);
  });
});

describe('deploy config', () => {
  it('builds on Netlify with the Node version from .nvmrc', () => {
    const toml = readFileSync('netlify.toml', 'utf8');
    expect(toml).toContain(`NODE_VERSION = "${readFileSync('.nvmrc', 'utf8').trim()}"`);
    expect(toml).toMatch(/publish = "dist"/);
  });

  it('runs e2e in CI on the Playwright image matching the installed version', () => {
    const version = JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')).version;
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toContain(
      `mcr.microsoft.com/playwright:v${version}-noble`,
    );
  });
});
