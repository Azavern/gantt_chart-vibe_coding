import { formatIDR, parseISODate } from '@gantt/shared';

/**
 * Pemformat tampilan (locale Indonesia). Semua tanggal masuk berupa string ISO
 * `YYYY-MM-DD` dan dibaca sebagai tanggal UTC murni.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** `12 Okt 2026`. */
export function formatDate(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `Senin, 12 Oktober 2026`. */
export function formatDateLong(iso: string): string {
  const date = parseISODate(iso);
  return `${DAYS_LONG[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `Okt 2026`. */
export function formatMonth(iso: string): string {
  const date = parseISODate(iso);
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function monthLabel(monthIndex: number): string {
  return MONTHS_LONG[monthIndex] ?? '';
}

export function dayShort(dayIndex: number): string {
  return DAYS_SHORT[dayIndex] ?? '';
}

/** `1.250.000` tanpa mata uang. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** `Rp 1.250.000`. */
export function formatCurrency(value: number): string {
  return formatIDR(value);
}

/** `65%`. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function todayISO(): string {
  const now = new Date();
  const year = now.getUTCFullYear().toString().padStart(4, '0');
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
