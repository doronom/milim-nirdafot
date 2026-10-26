import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-device e2e against the local Firebase emulators (Auth and Firestore with the real rules):
 * `npm run test:e2e:sync` starts the emulators and runs these tests on an emulator build of the app.
 */
export default defineConfig({
  testDir: 'e2e-sync',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-sync' }]] : 'list',
  globalSetup: './e2e-sync/global-setup.ts',
  use: { baseURL: 'http://localhost:4174/', trace: 'retain-on-failure', ...devices['Pixel 7'] },
  webServer: {
    command: 'npm run build:emulator && npx vite preview --outDir dist-emulator --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
