import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000, // E2E tests may take longer
    hookTimeout: 30000,
    setupFiles: ['./src/setup.ts'],
  },
});
