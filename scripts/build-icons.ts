/**
 * npm run build:icons
 * Renders the app icons from the mascot (src/design/assets/mascot.svg) into public/icons: 192 and 512 px, a maskable
 * 512 px with the safe-zone padding Android needs, and the 180 px Apple touch icon. Re-run after the mascot changes.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'src/design/assets/mascot.svg'), 'utf8');
const tokens = JSON.parse(readFileSync(resolve(root, 'src/design/tokens.json'), 'utf8'));
const background: string = tokens.colors?.base?.bg_dark ?? '#0a0f1d';
const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });

/** Icon size, and the share of it the mascot fills (maskable icons keep the art inside the central 80%). */
const icons = [
  { file: 'icon-192.png', size: 192, fill: 0.9 },
  { file: 'icon-512.png', size: 512, fill: 0.9 },
  { file: 'icon-maskable-512.png', size: 512, fill: 0.7 },
  { file: 'apple-touch-icon.png', size: 180, fill: 0.8 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, fill } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const art = Math.round(size * fill);
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${background}">` +
      `<div style="width:${art}px;height:${art}px">${svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"')}</div></body>`,
  );
  await page.screenshot({ path: resolve(out, file), omitBackground: false });
  console.log(`public/icons/${file}`);
}
await browser.close();
