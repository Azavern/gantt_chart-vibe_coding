import path from 'node:path';

import dotenv from 'dotenv';

/**
 * Semua entry point server (index, seed, test) memuat `.env` dari root repository.
 * Dari `server/src` maupun `server/dist`, dua level ke atas adalah root repository.
 */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  dotenv.config({ path: path.join(REPO_ROOT, '.env') });
  loaded = true;
}

loadEnv();
