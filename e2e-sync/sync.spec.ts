import { expect, test, type Page } from '@playwright/test';
import { enterPasscode, hold, PASS, progress, readKey, seed } from '../e2e/helpers';
import { PARENT_A, resetEmulators, STRANGER } from './emulator';

test.beforeEach(async () => resetEmulators());

/** Opens parent mode and signs in with a fake Google account (emulator builds only). */
async function signInParent(page: Page, email: string) {
  await page.goto('./#/parent-mode');
  await page.waitForFunction(() => 'wqTestSignIn' in window || '__wqTestSignIn' in window);
  await page.evaluate(
    (e) => (window as unknown as { __wqTestSignIn: (e: string) => Promise<void> }).__wqTestSignIn(e),
    email,
  );
}

const areLinked = (page: Page, a: string, b: string) =>
  page.evaluate(
    ([x, y]) =>
      (window as unknown as { __wqTest: { areLinked(a: string, b: string): boolean } }).__wqTest.areLinked(x!, y!),
    [a, b],
  );

/** Plays level 1.1 (seed 7: pick, drag, memory) with correct answers, as the component tests do. */
async function playLevel(page: Page) {
  await page.goto('./#/level/w1-emotions-1?seed=7');
  for (;;) {
    const next = page.getByRole('button', { name: /הבנתי/ });
    const label = await next.textContent();
    await next.click();
    if (label?.includes('בואו נתרגל')) break;
  }
  // Pick the synonym.
  for (;;) {
    const prompt = (await page.locator('p[lang="he"]').first().textContent())!.trim();
    const options = page.getByRole('group', { name: 'אפשרויות' }).getByRole('button');
    for (let i = 0; i < (await options.count()); i++) {
      const word = (await options.nth(i).textContent())!.replace(/^\d+/, '').trim();
      if (await areLinked(page, prompt, word)) {
        await options.nth(i).click();
        break;
      }
    }
    const cont = page.getByRole('button', { name: /לשאלה הבאה|סיום הסבב/ });
    const done = (await cont.textContent())?.includes('סיום הסבב');
    await cont.click();
    if (done) break;
  }
  // Drag pairs (tap a chip, then its synonym).
  for (;;) {
    await page.getByText('גררו כל מילה אל המילה הנרדפת שלה').waitFor();
    for (;;) {
      const chips = page.getByRole('group', { name: 'מילים לגרירה' }).getByRole('button');
      if ((await chips.count()) === 0) break;
      const word = (await chips.first().textContent())!.trim();
      await chips.first().click();
      const targets = page.getByRole('group', { name: 'מילים נרדפות' }).getByRole('button');
      for (let i = 0; i < (await targets.count()); i++) {
        const t = targets.nth(i);
        if (!(await t.isDisabled()) && (await areLinked(page, word, (await t.textContent())!.trim()))) {
          await t.click();
          break;
        }
      }
    }
    const cont = page.getByRole('button', { name: /ללוח הבא|סיום הסבב/ });
    const done = (await cont.textContent())?.includes('סיום הסבב');
    await cont.click();
    if (done) break;
  }
  // Memory: learn the board two cards at a time, then match the pairs.
  await page.getByText('מצאו את הזוגות של מילים נרדפות').waitFor();
  const cards = page.locator('[class*="grid"] button');
  const total = await cards.count();
  const words: string[] = [];
  for (let i = 0; i < total; i += 2) {
    await cards.nth(i).click();
    words[i] = (await cards.nth(i).getAttribute('aria-label'))!;
    await cards.nth(i + 1).click();
    words[i + 1] = (await cards.nth(i + 1).getAttribute('aria-label'))!;
    await page.waitForTimeout(1200);
  }
  const matched = new Set<number>();
  for (let i = 0; i < total; i++) {
    if (matched.has(i) || (await cards.nth(i).isDisabled())) continue;
    for (let j = i + 1; j < total; j++) {
      if (matched.has(j) || !(await areLinked(page, words[i]!, words[j]!))) continue;
      await cards.nth(i).click();
      await cards.nth(j).click();
      matched.add(i).add(j);
      await page.waitForTimeout(300);
      break;
    }
  }
  await page.getByRole('button', { name: 'סיום הסבב' }).click();
  await expect(page.getByText(/מושלם!/)).toBeVisible();
}

test('a Google account that is not on the allowlist is told it is not authorized', async ({ page }) => {
  await signInParent(page, STRANGER);
  await expect(page.getByRole('heading', { name: 'החשבון הזה לא מורשה' })).toBeVisible();
  await expect(page.getByText(STRANGER)).toBeVisible();
  await expect(page.getByRole('heading', { name: /הילדים/ })).toHaveCount(0);
});

test('parent sets the passcode and pairs the child; the passcode works offline there; progress reaches parent mode', async ({
  browser,
}) => {
  // The parent's phone.
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await signInParent(parent, PARENT_A);
  await expect(parent.getByRole('heading', { name: /הילדים/ })).toBeVisible();
  await parent.getByLabel('קוד הורים חדש').fill(PASS);
  await parent.getByLabel('שוב, לאישור').fill(PASS);
  await parent.getByRole('button', { name: 'שמירת הקוד' }).click();
  await expect(parent.getByText(/קוד ההורים נשמר/)).toBeVisible();
  await parent.getByRole('button', { name: 'יצירת קוד חיבור' }).click();
  const code = (await parent.getByLabel('קוד החיבור').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // The child's device: never paired, so the parent area offers only pairing.
  const childContext = await browser.newContext();
  const child = await childContext.newPage();
  await seed(child, { progress: progress({ settings: { ...progress().settings, childName: 'Testchild Cohen' } }) });
  await child.goto('./#/parent');
  await child.reload();
  await hold(child, 3300);
  await child.getByLabel('קוד חיבור').fill(code.toLowerCase());
  await child.getByRole('button', { name: 'חיבור', exact: true }).click();
  await expect(child.getByLabel('קוד הורים', { exact: true })).toBeVisible();
  await expect(parent.getByText('המכשיר חובר!')).toBeVisible();
  // Only the hash came over.
  expect(JSON.stringify(await readKey(child, 'parent:lock'))).not.toContain(PASS);

  // Offline: the passcode is checked on the device.
  await childContext.setOffline(true);
  await enterPasscode(child, 'wrong-code-1');
  await expect(child.getByRole('alert')).toContainText('נותרו 2 ניסיונות');
  await enterPasscode(child);
  await expect(child.getByRole('navigation', { name: 'ניווט אזור ההורים' })).toBeVisible();
  await childContext.setOffline(false);

  // A code works once.
  const again = await browser.newContext();
  const other = await again.newPage();
  await seed(other, { progress: progress() });
  await other.goto('./#/parent');
  await other.reload();
  await hold(other, 3300);
  await other.getByLabel('קוד חיבור').fill(code);
  await other.getByRole('button', { name: 'חיבור', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('הקוד לא תקף');
  await again.close();

  // Play a level; the end of the level uploads at once.
  await playLevel(child);
  const card = parent.getByRole('listitem', { name: 'Testchild' });
  await expect(card).toBeVisible();
  await expect(card.getByText(/^[1-9]\d* XP$/)).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('1 שלבים')).toBeVisible();
  await card.getByRole('link', { name: 'לוח בקרה' }).click();
  await expect(parent.getByText(/תצוגה בלבד, מהסנכרון האחרון/)).toBeVisible();
  await expect(parent.getByText('דקות משחק בשבוע האחרון')).toBeVisible();
  // The child's failed attempt shows on the dashboard; the log came along.
  await expect(parent.getByRole('alert')).toContainText('ניסיון כניסה שגוי');
  await parent.getByRole('link', { name: /יומן הפעילות/ }).click();
  await expect(parent.getByText('המכשיר חובר לטלפון של ההורה')).toBeVisible();

  // A new passcode set in parent mode (the way to recover a forgotten one) replaces the old one on the next sync.
  await parent.getByRole('button', { name: 'חזרה למצב הורים' }).click();
  await parent.getByLabel('קוד הורים חדש').fill('River#Stone9');
  await parent.getByLabel('שוב, לאישור').fill('River#Stone9');
  await parent.getByRole('button', { name: 'שמירת הקוד' }).click();
  await expect(parent.getByText(/קוד ההורים נשמר/)).toBeVisible();
  await child.goto('./#/parent');
  await hold(child, 3300);
  await enterPasscode(child);
  await child.getByRole('link', { name: 'הגדרות' }).click();
  await child.getByRole('button', { name: 'סנכרון עכשיו' }).click();
  await expect(child.getByText('הסנכרון הושלם.')).toBeVisible();
  await child.goto('./#/');
  await child.goto('./#/parent');
  await hold(child, 3300);
  await enterPasscode(child);
  await expect(child.getByRole('alert')).toContainText('קוד שגוי');
  await enterPasscode(child, 'River#Stone9');
  await expect(child.getByRole('navigation', { name: 'ניווט אזור ההורים' })).toBeVisible();

  // Unpairing from the parent side reaches the child on its next sync, and is logged there.
  await parent.getByRole('button', { name: 'ניתוק ומחיקת נתוני הענן' }).click();
  await parent.getByRole('button', { name: 'כן, לנתק ולמחוק' }).click();
  await expect(parent.getByText(/עוד אין מכשיר מחובר/)).toBeVisible();
  await child.getByRole('link', { name: 'הגדרות' }).click();
  await child.getByRole('button', { name: 'סנכרון עכשיו' }).click();
  await expect(child.getByRole('button', { name: 'חיבור לטלפון של ההורה' })).toBeVisible();
  // The passcode on the device keeps working after unpairing.
  expect(await readKey(child, 'parent:lock')).toBeTruthy();
});
