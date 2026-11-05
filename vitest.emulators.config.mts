import { defineConfig } from 'vitest/config';

/**
 * Testes que dependem dos emuladores: Security Rules (tests/rules) e fluxos
 * integrados Auth + Firestore (tests/integration). Rodam via `npm run test:emulators`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
