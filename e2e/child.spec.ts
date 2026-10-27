import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { progress, seed } from './helpers';

/** Every distinct clip the game can play: all of them must be saved for offline use. */
const CLIP_COUNT = new Set(
  Object.values(
    (JSON.parse(readFileSync('src/generated/audio-manifest.json', 'utf8')) as { clips: Record<string, string> }).clips,
  ),
).size;
const savedClips = () => caches.open('wq-audio-v1').then(async (c) => (await c.keys()).length);

test('a new player goes from the welcome screen into the first level', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('textbox', { name: /איך קוראים לך/ }).fill('נועה');
  await page.getByRole('button', { name: 'מתחילים מנמל היסודות' }).click();
  await expect(page.getByRole('article', { name: 'נמל היסודות, פעיל עכשיו' })).toBeVisible();
  await page.getByRole('link', { name: /התחל במסע/ }).click();
  await page.getByRole('link', { name: /התחל שלב 1.1/ }).click();

  // Learn cards read the word with a generated clip, then the first round.
  await expect(page.getByRole('article', { name: /כרטיס לימוד/ })).toBeVisible();
  const clip = page.waitForResponse((r) => /\/audio\/[0-9a-f]{16}\.mp3$/.test(r.url()) && r.ok());
  await page.getByRole('button', { name: /^השמע: / }).click();
  await clip;
  for (;;) {
    const next = page.getByRole('button', { name: /הבנתי/ });
    const label = await next.textContent();
    await next.click();
    if (label?.includes('בואו נתרגל')) break;
  }
  const options = page.getByRole('group', { name: 'אפשרויות' }).getByRole('button');
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(page.getByRole('status').getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ })).toBeVisible();
});

test('works offline once loaded, word audio included: reload without a network', async ({ page, context }) => {
  await seed(page, { progress: progress({ xp: 120 }) });
  // The app installs from a small precache; the word audio is saved by the page, with a progress notice on the map.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByRole('region', { name: 'שמירת ההקראות' })).toBeHidden({ timeout: 45_000 });
  expect(await page.evaluate(savedClips)).toBe(CLIP_COUNT);

  // The first visit is not yet controlled by the worker; one reload hands control to it.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('article', { name: 'נמל היסודות, פעיל עכשיו' })).toBeVisible();
  // Nothing left to save, so no notice even offline.
  await expect(page.getByRole('region', { name: 'שמירת ההקראות' })).toBeHidden();
  await page.goto('./#/world/1');
  await page.getByRole('link', { name: /התחל שלב 1.1/ }).click();
  await expect(page.getByRole('article', { name: /כרטיס לימוד/ })).toBeVisible();
  // A word clip comes from the audio cache through the worker.
  const clip = page.waitForResponse((r) => /\/audio\/[0-9a-f]{16}\.mp3$/.test(r.url()) && r.ok());
  await page.getByRole('button', { name: /^השמע: / }).click();
  expect((await clip).fromServiceWorker()).toBe(true);
  // The parent area loads on first use; it is precached too.
  await page.goto('./#/parent');
  await expect(page.getByRole('heading', { name: 'כניסה לאזור ההורים' })).toBeVisible();
  await context.setOffline(false);
});

test('the map shows how much audio is saved, and resumes the download when the network returns', async ({
  page,
  context,
}) => {
  // Clips answer slowly, so the notice is visible; then the network drops and comes back.
  await context.route(/\/audio\/[0-9a-f]{16}\.mp3$/, async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    await route.continue().catch(() => undefined);
  });
  await seed(page, { progress: progress({ xp: 120 }) });
  const notice = page.getByRole('region', { name: 'שמירת ההקראות' });
  await expect(notice.getByText(/שומרים את ההקראות לשימוש בלי אינטרנט: \d+%/)).toBeVisible();
  await context.setOffline(true);
  await expect(notice.getByText(/יישמרו לשימוש בלי אינטרנט כשתחזור הרשת/)).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate(savedClips);
  expect(saved).toBeLessThan(CLIP_COUNT);
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.setOffline(false);
  await expect(notice).toBeHidden({ timeout: 45_000 });
  expect(await page.evaluate(savedClips)).toBe(CLIP_COUNT);
});

test('no screen scrolls sideways on a phone', async ({ page }) => {
  await seed(page, { progress: progress({ unlockedWorlds: [1, 2, 3, 4] }) });
  for (const path of ['./', './#/world/1', './#/adventure', './#/treasures', './#/profile', './#/parent']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});
