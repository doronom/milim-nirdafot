import { expect, test, type Page } from '@playwright/test';
import { enterPasscode, hold, PASS, progress, readKey, seed, seedPasscode } from './helpers';

const dashboard = (page: Page) => page.getByText('דקות משחק בשבוע האחרון');

async function openLock(page: Page) {
  await page.goto('./#/parent');
  await page.reload();
  await hold(page, 3300);
}

test('an unpaired device never offers to create a passcode: only pairing, and why', async ({ page }) => {
  await seed(page, { progress: progress() });
  await openLock(page);
  await expect(page.getByRole('form', { name: 'חיבור לטלפון של ההורה' })).toBeVisible();
  await expect(page.getByText(/מכשיר שעוד לא היה מחובר לאינטרנט לא יכול לפתוח את אזור ההורים/)).toBeVisible();
  await expect(page.getByLabel('קוד הורים', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/קוד שחזור/)).toHaveCount(0);
});

test('with a passcode from parent mode: a password field, the right passcode gets in', async ({ page }) => {
  await seed(page, { progress: progress() });
  await seedPasscode(page);
  await openLock(page);
  const field = page.getByLabel('קוד הורים', { exact: true });
  await expect(field).toHaveAttribute('type', 'password');
  await expect(field).toHaveAttribute('autocomplete', 'off');
  await expect(page.getByText(/קבעו קוד חדש במצב הורים/)).toBeVisible();
  await enterPasscode(page, 'not-the-code');
  await expect(page.getByRole('alert')).toContainText('נותרו 2 ניסיונות');
  await enterPasscode(page);
  await expect(dashboard(page)).toBeVisible();
});

test('three wrong passcodes lock entry, also after a restart, until the lockout ends', async ({ page }) => {
  await seed(page, { progress: progress() });
  await seedPasscode(page);
  await openLock(page);
  for (const [i, message] of ['נותרו 2 ניסיונות', 'נותר ניסיון אחד', 'לנסות שוב בעוד'].entries()) {
    await enterPasscode(page, `wrong-code-${i}`);
    await expect(page.getByRole('alert')).toContainText(message);
  }
  await expect(page.getByLabel('קוד הורים', { exact: true })).toBeDisabled();

  // A restart does not clear the lockout.
  await openLock(page);
  await expect(page.getByRole('alert')).toContainText('לנסות שוב בעוד');
  await expect(page.getByLabel('קוד הורים', { exact: true })).toBeDisabled();

  // Fast-forward: end the lockout in the stored state, as if the minute had passed.
  const lockout = (await readKey<{ lockedUntil: number }>(page, 'parent:lockout'))!;
  expect(lockout.lockedUntil - Date.now()).toBeGreaterThan(50_000);
  await seed(page, { 'parent:lockout': { ...lockout, lockedUntil: Date.now() - 1000 } });
  await openLock(page);
  await enterPasscode(page);
  await expect(dashboard(page)).toBeVisible();
});

test('a passcode set on the device before cloud sync keeps working until pairing replaces it', async ({ page }) => {
  await seed(page, { progress: progress() });
  await seedPasscode(page, 'Old&Local9', 'local');
  await openLock(page);
  await expect(page.getByRole('button', { name: /חיבור לטלפון של ההורה/ })).toBeVisible();
  await enterPasscode(page, 'Old&Local9');
  await expect(dashboard(page)).toBeVisible();
  expect(PASS).not.toBe('Old&Local9');
});

test('the child onboarding never asks for the passcode', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'מתחילים מנמל היסודות' }).click();
  await expect(page.getByRole('article', { name: 'נמל היסודות, פעיל עכשיו' })).toBeVisible();
  await expect(page.getByLabel(/קוד הורים/)).toHaveCount(0);
});
