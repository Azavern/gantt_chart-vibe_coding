import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const sharedSource = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Paket `shared` dipakai langsung dari sumber TypeScript agar pratinjau drag
      // selalu memakai mesin penjadwalan yang sama dengan server.
      '@gantt/shared': sharedSource,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
