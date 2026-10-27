import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { makeWav, SRT } from './fixtures';

test('E2E-4: a word saved from the Sentence sheet is in Vocabulary and exports as CSV', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Import').setInputFiles([
    { name: 'episode-01.wav', mimeType: 'audio/wav', buffer: makeWav(20) },
    { name: 'episode-01.srt', mimeType: 'application/x-subrip', buffer: Buffer.from(SRT) },
  ]);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: /episode-01/ }).click();

  // Sentence 2 starts at 0:04: "Today we talk about learning English."
  await page.getByRole('button', { name: 'Actions for sentence at 0:04' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'learning', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save to vocabulary' }).click();
  await expect(sheet.getByRole('status')).toHaveText('Saved “learning”');
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Back to library' }).click();
  await page.getByRole('link', { name: 'Vocabulary' }).click();
  const item = page.getByRole('listitem').filter({ hasText: 'learning' });
  await expect(item).toContainText('Today we talk about learning English.');
  await expect(item).toContainText('episode-01');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^vocabulary-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await file.path(), 'utf8');
  expect(csv.startsWith('\uFEFFword,sentence,episode,time,date\r\n')).toBe(true);
  expect(csv).toContain('learning,Today we talk about learning English.,episode-01,0:04,');
});
