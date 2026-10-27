// Renders the app icon (PWA-1) to PNG with Playwright's Chromium, so no image tools are needed.
// Run: pnpm icons
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BLUE = '#1a56db';
// A speech bubble holding a sound wave.
const symbol = `
  <path fill="#fff" d="M136 120h240a40 40 0 0 1 40 40v152a40 40 0 0 1-40 40H232l-72 56v-56h-24a40 40 0 0 1-40-40V160a40 40 0 0 1 40-40z"/>
  <g fill="${BLUE}">
    <rect x="164" y="216" width="24" height="40" rx="12"/>
    <rect x="204" y="186" width="24" height="100" rx="12"/>
    <rect x="244" y="166" width="24" height="140" rx="12"/>
    <rect x="284" y="186" width="24" height="100" rx="12"/>
    <rect x="324" y="216" width="24" height="40" rx="12"/>
  </g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;

const icon = svg(`<rect width="512" height="512" rx="112" fill="${BLUE}"/>${symbol}`);
// Maskable: full-bleed background, symbol inside the 80% safe zone.
const maskable = svg(
  `<rect width="512" height="512" fill="${BLUE}"/><g transform="translate(256 256) scale(0.72) translate(-256 -256)">${symbol}</g>`,
);

await writeFile('public/icon.svg', icon + '\n');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, source] of [
  ['icon-192.png', 192, icon],
  ['icon-512.png', 512, icon],
  ['icon-maskable-512.png', 512, maskable],
  ['apple-touch-icon.png', 180, maskable], // iOS rounds the corners itself
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  await page.screenshot({ path: `public/${file}`, omitBackground: true });
}
await browser.close();
