import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Database uji dipakai bersama, jadi file test dijalankan berurutan.
    fileParallelism: false,
    globalSetup: ['./src/tests/global-setup.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'jwt-secret-khusus-pengujian',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
