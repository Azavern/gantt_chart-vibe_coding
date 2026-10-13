import { PrismaClient } from '@prisma/client';

import './env';

/**
 * Satu instance PrismaClient untuk seluruh proses server.
 * Pengujian memakai DATABASE_URL terpisah yang diatur di vitest.config.ts.
 */
export const prisma = new PrismaClient();

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
