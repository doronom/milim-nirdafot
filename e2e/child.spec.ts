import { expect, test } from '@playwright/test';
import { progress, seed } from './helpers';

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

test('works offline once loaded: reload without a network', async ({ page, context }) => {
  await seed(page, { progress: progress({ xp: 120 }) });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first visit is not yet controlled by the worker; one reload hands control to it.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('article', { name: 'נמל היסודות, פעיל עכשיו' })).toBeVisible();
  await page.goto('./#/world/1');
  await page.getByRole('link', { name: /התחל שלב 1.1/ }).click();
  await expect(page.getByRole('article', { name: /כרטיס לימוד/ })).toBeVisible();
  // The parent area loads on first use; it is precached too.
  await page.goto('./#/parent');
  await expect(page.getByRole('heading', { name: 'שער בקרת הורים' })).toBeVisible();
  await context.setOffline(false);
});

test('no screen scrolls sideways on a phone', async ({ page }) => {
  await seed(page, { progress: progress({ unlockedWorlds: [1, 2, 3, 4] }) });
  for (const path of ['./', './#/world/1', './#/adventure', './#/treasures', './#/profile', './#/parent']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});
