import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Runs against the production build (`pnpm e2e` builds first), so the service worker and
// the Content-Security-Policy are part of every test.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}/` },
  webServer: {
    command: `pnpm preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
