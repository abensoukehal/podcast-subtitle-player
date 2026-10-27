import { expect, test } from '@playwright/test';
import { importFixture } from './fixtures';

test('E2E-5: after the first load, the app opens and plays offline', async ({ page, context }) => {
  await importFixture(page);
  // The first visit installs the service worker; it controls the page from the next load.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: /episode-01/ }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByRole('slider', { name: 'Seek' }).inputValue()))
    .toBeGreaterThan(0);
});
