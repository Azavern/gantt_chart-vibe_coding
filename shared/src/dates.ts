/**
 * Utilitas tanggal (blueprint 6.1). Semua tanggal diperlakukan sebagai tanggal
 * UTC murni agar tidak ada pergeseran satu hari karena zona waktu lokal.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Mengubah `YYYY-MM-DD` menjadi `Date` pada tengah malam UTC.
 * Melempar error bila format atau tanggalnya tidak valid.
 */
export function parseISODate(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Tanggal tidak valid: "${value}" (harus format YYYY-MM-DD)`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Tanggal tidak ada di kalender: "${value}"`);
  }

  return date;
}

export function isValidISODate(value: string): boolean {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

/** Mengubah `Date` menjadi string `YYYY-MM-DD` memakai komponen UTC. */
export function formatISODate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Menambah (atau mengurangi) sejumlah hari kalender. */
export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

/** Selisih hari kalender `b - a` (boleh negatif). */
export function diffInDays(a: string, b: string): number {
  const delta = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(delta / 86_400_000);
}

/** Hari dalam minggu menurut UTC: 0 = Minggu ... 6 = Sabtu. */
export function dayOfWeek(value: string): number {
  return parseISODate(value).getUTCDay();
}

/** Perbandingan dua tanggal ISO: -1 bila a < b, 0 bila sama, 1 bila a > b. */
export function compareISODate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function maxISODate(a: string, b: string): string {
  return compareISODate(a, b) >= 0 ? a : b;
}

export function minISODate(a: string, b: string): string {
  return compareISODate(a, b) <= 0 ? a : b;
}

/** Rentang tanggal inklusif dari `start` sampai `end`. */
export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (compareISODate(current, end) <= 0) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}
