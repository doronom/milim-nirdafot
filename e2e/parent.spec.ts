import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { hold, openParent, progress, readKey, seed, today } from './helpers';

const card = (box: number, lapses = 0) => ({ box, due: '2026-01-01', seen: 3, lapses, lastSeen: '2026-01-01' });

test('the gate keeps the child out until a 3-second hold and the right answer', async ({ page }) => {
  await seed(page, { progress: progress() });
  await page.goto('./#/parent');
  await hold(page, 1000);
  await expect(page.getByText('שאלת חשבון')).toHaveCount(0);
  await openParent(page);
  await expect(page.getByText('דקות משחק בשבוע האחרון')).toBeVisible();
});

test('dashboard shows play time and the words to strengthen', async ({ page }) => {
  await seed(page, {
    progress: progress({ activity: { [today()]: 12 * 60 }, leitner: { 'b031|ענק': card(1, 3), 'b035|לוהט': card(5) } }),
  });
  await openParent(page);
  await expect(page.getByText('גדול = ענק')).toBeVisible();
  await expect(page.getByText('חם = לוהט')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'התקדמות ליעד היומי' })).toHaveAttribute('aria-valuenow', '12');
});

test('editing content: invalid edits are blocked, valid ones play, revert, review and export', async ({ page }) => {
  await seed(page, { progress: progress({ leitner: { 'b031|כביר': card(3), 'b031|ענק': card(3) } }) });
  await openParent(page, '/content');
  await page.getByRole('tab', { name: /כל התוכן/ }).click();
  await page.getByLabel('חיפוש בתוכן').fill('ענק, עצום');
  const item = page.getByRole('listitem', { name: 'גדול', exact: true });
  await item.getByRole('button', { name: 'עריכה' }).click();

  await item.getByLabel(/מילים נרדפות/).fill('גדול');
  await item.getByRole('button', { name: 'שמירה' }).click();
  await expect(item.getByRole('alert')).toContainText('המילה מופיעה כנרדפת של עצמה');

  await item.getByLabel(/מילים נרדפות/).fill('ענק, עצום, אדיר');
  await item.getByRole('button', { name: 'שמירה' }).click();
  await expect(item.getByText('נערך')).toBeVisible();
  await expect
    .poll(async () => Object.keys((await readKey<{ leitner: object }>(page, 'progress'))!.leitner).sort())
    .toEqual(['b031|אדיר', 'b031|ענק']);

  // The edit survives a reload (IndexedDB), and the bundled data is untouched by it.
  await page.reload();
  await openParent(page, '/content');
  await page.getByRole('tab', { name: /כל התוכן/ }).click();
  await page.getByRole('button', { name: /נערכו/ }).click();
  await expect(page.getByRole('listitem', { name: 'גדול', exact: true })).toContainText('ענק, עצום, אדיר');

  await page.getByRole('tab', { name: /טיוטות/ }).click();
  const draft = page.getByRole('listitem', { name: 'מאוכזב' }).first();
  await draft.getByRole('button', { name: /לאשר/ }).click();
  await expect(draft.getByText('אושר')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /ייצוא שינויי תוכן/ }).click();
  const file = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(file.format).toBe('word-quest-content-changes');
  expect(file.edits.entries.b031).toEqual({ synonyms: ['ענק', 'עצום', 'אדיר'] });
  expect(file.decisions.e001).toBe('approved');

  await page.getByRole('tab', { name: /כל התוכן/ }).click();
  await page.getByLabel('חיפוש בתוכן').fill('אדיר');
  await page
    .getByRole('listitem', { name: 'גדול', exact: true })
    .getByRole('button', { name: /חזרה למקור/ })
    .click();
  await expect(page.getByRole('listitem', { name: 'גדול', exact: true })).toHaveCount(0);
});

test('a new custom word gets a World 1 station and its learn card', async ({ page }) => {
  await seed(page, { progress: progress() });
  await openParent(page, '/words');
  await page.getByRole('button', { name: /מילה חדשה/ }).click();
  await page.getByLabel('מילת מטרה').fill('ענווה');
  await page.getByLabel(/מילים נרדפות/).fill('צניעות, פשטות');
  await page.getByRole('button', { name: 'שמירת המילה' }).click();
  await expect(page.getByText(/נשמר:/)).toBeVisible();

  await page.goto('./#/world/1');
  const marker = page.getByText(/תחנה \d+: המילים שלי/);
  await expect(marker).toBeVisible();
  const n = (await marker.textContent())!.match(/\d+/)![0];
  await page.getByRole('link', { name: `שלב ${n}.1: היכרות` }).click();
  await expect(page.getByRole('article', { name: 'כרטיס לימוד: ענווה' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'צניעות' })).toBeVisible();
});

test('backup exports plain JSON and restores it after a reset', async ({ page }) => {
  await seed(page, { progress: progress({ xp: 777, settings: { ...progress().settings, childName: 'נועה' } }) });
  await openParent(page, '/backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת קובץ גיבוי' }).click();
  const path = (await (await download).path())!;
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(backup.format).toBe('word-quest-backup');
  expect(backup.data.progress.xp).toBe(777);

  await page.getByRole('link', { name: 'הגדרות' }).click();
  await page.getByRole('button', { name: /איפוס נתוני המסע/ }).click();
  await page.getByRole('button', { name: /כן, לאפס הכל/ }).click();
  await expect.poll(async () => (await readKey<{ xp: number }>(page, 'progress'))!.xp).toBe(0);

  await page.getByRole('link', { name: 'גיבוי' }).click();
  await page.getByLabel('קובץ גיבוי', { exact: true }).setInputFiles(path);
  await page.getByRole('button', { name: /שחזור והפעלה מחדש/ }).click();
  await page.waitForLoadState('load');
  await expect.poll(async () => (await readKey<{ xp: number }>(page, 'progress'))?.xp).toBe(777);
});
