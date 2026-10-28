import { expect, test, type Page } from '@playwright/test';
import { openParent, progress, seed } from './helpers';

/** The phone on its side: the device's portrait viewport, turned. */
async function turn(page: Page) {
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: Math.max(width, height), height: Math.min(width, height) });
}

const everything = () =>
  progress({ xp: 420, unlockedWorlds: [1, 2, 3, 4], settings: { ...progress().settings, unlockAll: true } });

/** One game of each kind, with a level whose items it can play (?game= plays one round of it). */
const GAMES: [game: string, level: string, play: string][] = [
  ['pickSynonym', 'w1-emotions-1', 'אפשרויות'],
  ['dragPairs', 'w1-emotions-1', 'מילים נרדפות'],
  ['memory', 'w1-emotions-1', ''],
  ['wordSearch', 'w2-emotions-1', 'לוח התפזורת'],
  ['oddOneOut', 'w2-emotions-1', 'בועות'],
  ['swapWord', 'w2-emotions-1', 'בנק המילים'],
  ['typeSynonym', 'w2-emotions-1', ''],
  ['crossword', 'w2-emotions-1', 'לוח התשבץ'],
  ['intensityLadder', 'w3-scales-1', ''],
  ['registerSort', 'w3-registers-1', ''],
  ['contextChoice', 'w3-contexts-1', 'אפשרויות'],
  ['idiomMatch', 'w4-idioms-1', 'אפשרויות'],
];

test('turning the phone switches to the landscape layout and back', async ({ page }) => {
  await seed(page, { progress: everything() });
  const layout = () => page.evaluate(() => document.documentElement.dataset.layout ?? 'portrait');
  expect(await layout()).toBe('portrait');
  const portrait = page.viewportSize()!;
  await turn(page);
  await expect.poll(layout).toBe('landscape');
  // The tabs become a rail on the side: taller than wide, and the map uses the rest of the width.
  const rail = (await page.getByRole('navigation').boundingBox())!;
  expect(rail.height).toBeGreaterThan(rail.width);
  await page.setViewportSize(portrait);
  await expect.poll(layout).toBe('portrait');
});

test('every game fits the screen in landscape: what to touch is in view without scrolling', async ({ page }) => {
  await seed(page, { progress: everything() });
  await turn(page);
  const height = page.viewportSize()!.height;
  for (const [game, level, play] of GAMES) {
    await page.goto(`./#/level/${level}?seed=5&game=${game}`);
    await page.reload();
    await page.getByRole('button', { name: 'מתחילים' }).click();
    const target = play
      ? page.getByRole(game === 'wordSearch' || game === 'crossword' ? 'grid' : 'group', { name: play })
      : page.locator('main button').first();
    await expect(target, game).toBeVisible();
    const box = (await target.boundingBox())!;
    expect(box.y + Math.min(box.height, height / 3), `${game} starts on screen`).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => scrollY), game).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), game).toBe(true);
  }
});

test('the learn card and its button share the screen in landscape', async ({ page }) => {
  await seed(page, { progress: everything() });
  await turn(page);
  await page.goto('./#/level/w1-emotions-1?seed=3');
  await page.reload();
  const next = page.getByRole('button', { name: /הבנתי/ });
  await expect(page.getByRole('article', { name: /כרטיס לימוד/ })).toBeVisible();
  const box = (await next.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test('no screen scrolls sideways in landscape, the parent area included', async ({ page }) => {
  await seed(page, { progress: everything() });
  await turn(page);
  for (const path of ['./', './#/world/1', './#/adventure', './#/treasures', './#/profile', './#/speed', './#/duel']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  await openParent(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const rail = (await page.getByRole('navigation', { name: 'ניווט אזור ההורים' }).boundingBox())!;
  expect(rail.height).toBeGreaterThan(rail.width);
});

test('any screen can be scrolled so its bottom clears an overlay in the corner (the host badge)', async ({ page }) => {
  // Portrait and landscape: the parent lock's hold button and the bottom tabs must never be stuck under it.
  await seed(page, { progress: everything() });
  for (const orientation of ['portrait', 'landscape']) {
    if (orientation === 'landscape') await turn(page);
    for (const path of ['./', './#/parent']) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const room = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(room, `${orientation} ${path}`).toBeGreaterThanOrEqual(72);
    }
  }
});
