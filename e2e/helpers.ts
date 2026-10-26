import { expect, type Page } from '@playwright/test';

/** Local YYYY-MM-DD, as the app keys days. */
export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Writes keys straight into the app's IndexedDB store (after the app has created it), then reloads. */
export async function seed(page: Page, values: Record<string, unknown>): Promise<void> {
  await page.goto('./');
  await page.waitForSelector('#root *');
  await page.evaluate(async (values) => {
    const req = indexedDB.open('word-quest');
    const db = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction('kv', 'readwrite');
    for (const [k, v] of Object.entries(values)) tx.objectStore('kv').put(v, k);
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  }, values);
  // Hash navigation alone keeps the app (and the progress it loaded) in memory.
  await page.reload();
}

export async function readKey<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(async (key) => {
    const req = indexedDB.open('word-quest');
    const db = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const get = db.transaction('kv').objectStore('kv').get(key);
    const value = await new Promise((r) => (get.onsuccess = () => r(get.result)));
    db.close();
    return value as T | undefined;
  }, key);
}

export const progress = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  onboarded: true,
  levels: {},
  unlockedWorlds: [1],
  xp: 0,
  streak: { days: 0, freezes: 1, lastPlayed: null },
  leitner: {},
  settings: { unlockAll: false, reviewedOnly: false, reviewedSentencesOnly: false, speedMode: true },
  ...extra,
});

/** Holds the gate button for `ms` (its label changes once the hold completes, so keep the element). */
export async function hold(page: Page, ms: number): Promise<void> {
  const button = await page.getByRole('button', { name: /החזיקו לחוץ/ }).elementHandle();
  await button!.dispatchEvent('pointerdown');
  await page.waitForTimeout(ms);
  await button!.dispatchEvent('pointerup');
}

/** Opens a parent page through the gate: a 3-second hold, then the multiplication on the keypad. */
export async function openParent(page: Page, path = ''): Promise<void> {
  await page.goto(`./#/parent${path}`);
  await page.reload();
  await hold(page, 3300);
  const question = await page.getByText(/× .* = \?/).textContent();
  const [a, b] = question!.match(/\d+/g)!.map(Number) as [number, number];
  for (const ch of String(a * b)) await page.getByRole('button', { name: ch, exact: true }).click();
  await page.getByRole('button', { name: /אימות וכניסה/ }).click();
  await expect(page.getByRole('navigation', { name: 'ניווט אזור ההורים' })).toBeVisible();
}
