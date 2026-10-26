import { defineConfig } from 'vitest/config';

/** Firestore Security Rules tests: run inside the emulator with `npm run test:rules`. */
export default defineConfig({
  test: {
    include: ['tests-rules/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
