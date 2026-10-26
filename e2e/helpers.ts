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
  // Hash navigation alone keeps the app (and the progress it loaded) in memory, so reload, from the map: a reload on
  // #/welcome would redirect later and race the test's next navigation.
  await page.goto('./#/');
  await page.reload();
  const onboarded = (values.progress as { onboarded?: boolean } | undefined)?.onboarded;
  if (onboarded) await page.getByRole('article').first().waitFor();
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

/** The parent passcode the e2e tests set. */
export const PASS = 'Tiger&Moon7';

/** Sets a new passcode on the setup screen (typed twice) and confirms the recovery code; returns that code. */
export async function setPasscode(page: Page, passcode = PASS): Promise<string> {
  await page.getByLabel('קוד הורים', { exact: true }).fill(passcode);
  await page.getByLabel('שוב, לאישור').fill(passcode);
  await page.getByRole('button', { name: 'המשך' }).click();
  const code = (await page.getByLabel('קוד השחזור', { exact: true }).textContent())!.trim();
  await page.getByRole('checkbox', { name: /רשמתי את קוד השחזור/ }).check();
  await page.getByRole('button', { name: 'סיום וכניסה' }).click();
  // Saving hashes the passcode and the code first; a reload before the area opens would cancel it.
  await expect(page.getByRole('navigation', { name: 'ניווט אזור ההורים' })).toBeVisible();
  return code;
}

export async function enterPasscode(page: Page, passcode = PASS): Promise<void> {
  await page.getByLabel('קוד הורים', { exact: true }).fill(passcode);
  await page.getByRole('button', { name: 'כניסה', exact: true }).click();
}

/** Opens a parent page through the lock: the 3-second hold, then the passcode (set on first entry). */
export async function openParent(page: Page, path = ''): Promise<void> {
  await page.goto(`./#/parent${path}`);
  await page.reload();
  await hold(page, 3300);
  // The setup screen (first entry) has a confirmation field; the entry screen does not.
  await page.getByLabel('קוד הורים', { exact: true }).waitFor();
  if ((await page.getByLabel('שוב, לאישור').count()) > 0) await setPasscode(page);
  else await enterPasscode(page);
  await expect(page.getByRole('navigation', { name: 'ניווט אזור ההורים' })).toBeVisible();
}
