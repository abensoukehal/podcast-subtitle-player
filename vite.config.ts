import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// DEP-3. Build only: the dev server needs inline scripts for hot reload.
const CSP = "default-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:";

export default defineConfig({
  base: './', // DEP-1: works under any sub-path
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // PWA-3: never reload on its own
      injectRegister: false, // registered in UpdatePrompt.tsx
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Subtitle Player',
        short_name: 'Subtitles',
        description: 'Listen to podcasts with synced subtitles and practice English.',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#fbfaf7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // PWA-2: the app shell only. Audio lives in IndexedDB and is never fetched.
      workbox: { globPatterns: ['**/*.{html,js,css,svg,png,webmanifest}'] },
    }),
    {
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace(
          '<meta charset="utf-8" />',
          `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        ),
    },
  ],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
