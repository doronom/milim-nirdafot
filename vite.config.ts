import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';
import tokens from './src/design/tokens.json';

const background = tokens.colors.base.bg_dark;

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (GitHub Pages) and from the home-screen app.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // Offline-first: everything, audio included, is precached on the first visit. A new version installs in the
      // background and waits until the app is next opened: no reload ever interrupts a child mid-level.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'מסע המילים',
        short_name: 'מסע המילים',
        description: 'משחק מילים נרדפות בעברית',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        // Portrait and landscape both work (landscape gets its own pane layouts, src/design/layout.ts).
        orientation: 'any',
        background_color: background,
        theme_color: background,
        categories: ['education', 'games', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3,webmanifest}'],
        // The main bundle carries all the word data.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // A few tests sweep every entry, tier and seed; CI machines are slower than a laptop.
    testTimeout: 30_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
