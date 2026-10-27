import { expect, test, type Page } from '@playwright/test';
import { makeWav, SENTENCES, sentenceStart, SRT } from './fixtures';

async function importFixture(page: Page) {
  await page.goto('/');
  await page.getByLabel('Import').setInputFiles([
    { name: 'episode-01.wav', mimeType: 'audio/wav', buffer: makeWav(20) },
    { name: 'episode-01.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(SRT) },
  ]);
  await expect(page.getByText('Added')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
}

/** The seek bar has 1 s steps, so its value is the time rounded to a second. */
const seekValue = async (page: Page) =>
  Number(await page.getByRole('slider', { name: 'Seek' }).inputValue());

/** lastPositionSec of the only episode, read straight from IndexedDB. */
const savedPosition = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('subtitle-player');
        open.onsuccess = () => {
          const all = open.result.transaction('episodes').objectStore('episodes').getAll();
          all.onsuccess = () => resolve(all.result[0]?.lastPositionSec ?? -1);
        };
      }),
  );

const current = (page: Page) => page.locator('li[aria-current="true"]');

test('E2E-1: an imported pair appears in the library', async ({ page }) => {
  await importFixture(page);
  const card = page.getByRole('listitem').filter({ hasText: 'episode-01' });
  await expect(card).toContainText('0:20');
  await expect(card).toContainText('6 sentences');
});

test('E2E-2 and E2E-3: highlight follows playback, tap seeks, position survives a reload', async ({
  page,
}) => {
  await importFixture(page);
  await page.getByRole('link', { name: /episode-01/ }).click();
  await expect(current(page)).toContainText(SENTENCES[0]!);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(current(page)).toContainText(SENTENCES[1]!, { timeout: 8000 });

  await page.getByRole('button', { name: new RegExp(SENTENCES[3]!) }).click();
  await expect(current(page)).toContainText(SENTENCES[3]!);
  expect(Math.abs((await seekValue(page)) - sentenceStart(3))).toBeLessThanOrEqual(1);

  // Pause inside sentence 4, past the 0.15 s lead-in that belongs to sentence 3.
  await expect.poll(() => seekValue(page)).toBeGreaterThanOrEqual(sentenceStart(3) + 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // The pause saves the position (STO-2); a write still running during unload can be lost.
  await expect.poll(() => savedPosition(page)).toBeGreaterThan(sentenceStart(3));
  const saved = await savedPosition(page);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  expect(Math.abs((await seekValue(page)) - saved)).toBeLessThanOrEqual(0.5);
  await expect(current(page)).toContainText(SENTENCES[3]!);
});
