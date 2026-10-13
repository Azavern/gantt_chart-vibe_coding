import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Menyiapkan database SQLite terpisah untuk pengujian (`server/prisma/test.db`)
 * dengan menjalankan migrasi yang ada, sehingga skema yang diuji sama dengan
 * yang dipakai aplikasi.
 */

const TEST_DATABASE_URL = 'file:./test.db';

export default function setup(): void {
  const serverDir = path.resolve(__dirname, '..', '..');
  const prismaDir = path.join(serverDir, 'prisma');

  for (const file of ['test.db', 'test.db-journal', 'test.db-wal', 'test.db-shm']) {
    const target = path.join(prismaDir, file);
    if (fs.existsSync(target)) fs.rmSync(target);
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
    shell: true,
  });
}
