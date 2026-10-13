import { addDays, compareISODate, dayOfWeek } from './dates';

/**
 * Kalender proyek (blueprint 6.2): akhir pekan + hari libur khusus.
 * Semua perhitungan durasi hanya menghitung hari kerja.
 */
export interface ProjectCalendar {
  /** 0 = Minggu ... 6 = Sabtu. */
  weekendDays: number[];
  /** Himpunan tanggal ISO `YYYY-MM-DD`. */
  holidays: Set<string>;
}

export const DEFAULT_WEEKEND_DAYS: readonly number[] = [0, 6];

const MAX_SCAN_DAYS = 3650;

export function validateWeekendDays(days: readonly number[]): string | null {
  if (!Array.isArray(days)) {
    return 'Akhir pekan harus berupa daftar hari.';
  }
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return 'Hari akhir pekan harus angka 0 (Minggu) sampai 6 (Sabtu).';
  }
  if (new Set(days).size !== days.length) {
    return 'Hari akhir pekan tidak boleh berulang.';
  }
  if (days.length === 7) {
    return 'Akhir pekan tidak boleh berisi ketujuh hari karena tidak ada hari kerja tersisa.';
  }
  return null;
}

export function createCalendar(
  weekendDays: readonly number[] = DEFAULT_WEEKEND_DAYS,
  holidays: Iterable<string> = [],
): ProjectCalendar {
  const error = validateWeekendDays(weekendDays);
  if (error) throw new Error(error);

  return {
    weekendDays: [...weekendDays].sort((a, b) => a - b),
    holidays: new Set(holidays),
  };
}

/** Mengubah penyimpanan DB `"0,6"` menjadi `[0, 6]`. */
export function parseWeekendDays(value: string | null | undefined): number[] {
  if (!value) return [...DEFAULT_WEEKEND_DAYS];
  const days = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return days.length > 0 ? Array.from(new Set(days)).sort((a, b) => a - b) : [...DEFAULT_WEEKEND_DAYS];
}

export function serializeWeekendDays(days: readonly number[]): string {
  return [...days].sort((a, b) => a - b).join(',');
}

export function isWeekend(calendar: ProjectCalendar, date: string): boolean {
  return calendar.weekendDays.includes(dayOfWeek(date));
}

export function isHoliday(calendar: ProjectCalendar, date: string): boolean {
  return calendar.holidays.has(date);
}

export function isWorkingDay(calendar: ProjectCalendar, date: string): boolean {
  return !isWeekend(calendar, date) && !isHoliday(calendar, date);
}

/** `date` sendiri bila hari kerja; bila bukan, maju ke hari kerja berikutnya. */
export function nextWorkingDay(calendar: ProjectCalendar, date: string): string {
  let current = date;
  for (let i = 0; i <= MAX_SCAN_DAYS; i += 1) {
    if (isWorkingDay(calendar, current)) return current;
    current = addDays(current, 1);
  }
  throw new Error('Tidak ditemukan hari kerja dalam rentang pencarian kalender.');
}

/** Hari kerja terakhir pada atau sebelum `date`. */
export function previousWorkingDay(calendar: ProjectCalendar, date: string): string {
  let current = date;
  for (let i = 0; i <= MAX_SCAN_DAYS; i += 1) {
    if (isWorkingDay(calendar, current)) return current;
    current = addDays(current, -1);
  }
  throw new Error('Tidak ditemukan hari kerja dalam rentang pencarian kalender.');
}

/**
 * Menggeser `date` sebanyak `amount` hari kerja (boleh negatif).
 * Bila `date` bukan hari kerja, dipakai hari kerja berikutnya terlebih dahulu.
 */
export function shiftWorkingDays(calendar: ProjectCalendar, date: string, amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`Jumlah hari kerja harus bilangan bulat, diterima: ${amount}`);
  }

  let current = nextWorkingDay(calendar, date);
  if (amount === 0) return current;

  const step = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let scanned = 0;

  while (remaining > 0) {
    current = addDays(current, step);
    scanned += 1;
    if (scanned > MAX_SCAN_DAYS) {
      throw new Error('Tidak ditemukan hari kerja dalam rentang pencarian kalender.');
    }
    if (isWorkingDay(calendar, current)) remaining -= 1;
  }

  return current;
}

/** Jumlah hari kerja inklusif antara `start` dan `end` (0 bila `end` < `start`). */
export function workingDaysBetween(calendar: ProjectCalendar, start: string, end: string): number {
  if (compareISODate(end, start) < 0) return 0;

  let count = 0;
  let current = start;
  while (compareISODate(current, end) <= 0) {
    if (isWorkingDay(calendar, current)) count += 1;
    current = addDays(current, 1);
  }
  return count;
}
