import { defineConfig } from 'vitest/config';

// Dedicated Vitest config for the Firestore security-rules test harness.
//
// These tests are intentionally SEPARATE from the default `npm test` run:
//   - They require a running local Firestore emulator (launched via
//     `npm run test:rules`, which wraps `firebase emulators:exec`).
//   - The default Vitest config in vite.config.js already excludes `tests/**`,
//     so `npm test` never picks these up and never needs the emulator.
//
// Run with: npm run test:rules
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Emulator round-trips are slower than pure unit tests.
    testTimeout: 20000,
    hookTimeout: 40000,
    // Rules tests share one emulator; keep them sequential for isolation.
    fileParallelism: false,
  },
});
