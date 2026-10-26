import { expect, test, type Page } from '@playwright/test';
import { enterPasscode, hold, PASS, progress, readKey, seed, setPasscode } from './helpers';

const dashboard = (page: Page) => page.getByText('דקות משחק בשבוע האחרון');

async function openLock(page: Page) {
  await page.goto('./#/parent');
  await page.reload();
  await hold(page, 3300);
}

test('first entry sets a passcode; afterwards only the right passcode gets in', async ({ page }) => {
  await seed(page, { progress: progress() });
  await openLock(page);
  const field = page.getByLabel('קוד הורים', { exact: true });
  await expect(field).toHaveAttribute('type', 'password');
  await expect(field).toHaveAttribute('autocomplete', 'off');
  const code = await setPasscode(page);
  expect(code).toMatch(/^([A-Z0-9]{4}-){4}[A-Z0-9]{4}$/);
  await expect(dashboard(page)).toBeVisible();
  const lock = JSON.stringify(await readKey(page, 'parent:lock'));
  expect(lock).not.toContain(PASS);
  expect(lock).toContain('PBKDF2-SHA256');

  await openLock(page);
  await enterPasscode(page, 'not-the-code');
  await expect(page.getByRole('alert')).toContainText('נותרו 2 ניסיונות');
  await enterPasscode(page);
  await expect(dashboard(page)).toBeVisible();
});

test('three wrong passcodes lock entry, also after a restart, until the lockout ends', async ({ page }) => {
  await seed(page, { progress: progress() });
  await openLock(page);
  await setPasscode(page);
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

test('the recovery code resets a forgotten passcode and is replaced by a new one', async ({ page }) => {
  await seed(page, { progress: progress() });
  await openLock(page);
  const code = await setPasscode(page);
  await openLock(page);
  await page.getByRole('button', { name: 'שכחתי את הקוד' }).click();
  await page.getByLabel('קוד שחזור', { exact: true }).fill('AAAA-BBBB-CCCC-DDDD-EEEE');
  await page.getByRole('button', { name: 'אימות קוד השחזור' }).click();
  await expect(page.getByRole('alert')).toContainText('קוד שגוי');
  await page.getByLabel('קוד שחזור', { exact: true }).fill(code.toLowerCase());
  await page.getByRole('button', { name: 'אימות קוד השחזור' }).click();
  const next = await setPasscode(page, 'River#Stone9');
  expect(next).not.toBe(code);
  await expect(dashboard(page)).toBeVisible();

  await openLock(page);
  await enterPasscode(page, PASS);
  await expect(page.getByRole('alert')).toContainText('קוד שגוי');
  await enterPasscode(page, 'River#Stone9');
  await expect(dashboard(page)).toBeVisible();
  await page.getByRole('link', { name: 'הגדרות' }).click();
  await page.getByRole('link', { name: 'יומן הפעילות' }).click();
  await expect(page.getByText('קוד ההורים אופס בעזרת קוד השחזור, ונוצר קוד שחזור חדש')).toBeVisible();
});

test('the child onboarding never asks for the passcode', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'מתחילים מנמל היסודות' }).click();
  await expect(page.getByRole('article', { name: 'נמל היסודות, פעיל עכשיו' })).toBeVisible();
  await expect(page.getByLabel(/קוד הורים/)).toHaveCount(0);
});
