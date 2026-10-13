import './env';

export interface ServerConfig {
  port: number;
  jwtSecret: string;
  databaseUrl: string;
}

const DEFAULT_DATABASE_URL = 'file:./dev.db';

let cached: ServerConfig | null = null;

/** Konfigurasi di-cache agar validasi hanya terjadi sekali per proses. */
export function getConfig(): ServerConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/**
 * JWT_SECRET wajib ada. Server harus gagal start dengan pesan jelas bila kosong,
 * jadi pemeriksaan dilakukan saat start (bukan saat import).
 */
export function loadConfig(): ServerConfig {
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET belum diatur. Salin .env.example menjadi .env di root repository ' +
        'lalu isi JWT_SECRET dengan string acak.',
    );
  }

  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT tidak valid: "${process.env.PORT}". Gunakan angka port, misalnya 3001.`);
  }

  return {
    port,
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  };
}
