import rateLimit from 'express-rate-limit';

/**
 * Membatasi percobaan login dan registrasi (blueprint bagian 11) sebelum
 * pekerjaan verifikasi yang mahal seperti bcrypt dijalankan.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.',
      details: {},
    },
  },
});
