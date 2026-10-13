/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sharedSource = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gantt/shared': sharedSource,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
