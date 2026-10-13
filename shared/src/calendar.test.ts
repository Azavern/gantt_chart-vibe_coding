import { describe, expect, it } from 'vitest';

import {
  createCalendar,
  isHoliday,
  isWeekend,
  isWorkingDay,
  nextWorkingDay,
  parseWeekendDays,
  previousWorkingDay,
  serializeWeekendDays,
  shiftWorkingDays,
  validateWeekendDays,
  workingDaysBetween,
} from './calendar';

const calendar = createCalendar([0, 6], []);

describe('calendar', () => {
  it('menandai akhir pekan sebagai hari non-kerja', () => {
    expect(isWeekend(calendar, '2026-10-24')).toBe(true);
    expect(isWeekend(calendar, '2026-10-25')).toBe(true);
    expect(isWorkingDay(calendar, '2026-10-23')).toBe(true);
    expect(isWorkingDay(calendar, '2026-10-24')).toBe(false);
  });

  it('menandai hari libur sebagai hari non-kerja', () => {
    const withHoliday = createCalendar([0, 6], ['2026-10-26']);
    expect(isHoliday(withHoliday, '2026-10-26')).toBe(true);
    expect(isWorkingDay(withHoliday, '2026-10-26')).toBe(false);
    expect(isWorkingDay(calendar, '2026-10-26')).toBe(true);
  });

  it('nextWorkingDay mengembalikan hari itu sendiri bila sudah hari kerja', () => {
    expect(nextWorkingDay(calendar, '2026-10-23')).toBe('2026-10-23');
    expect(nextWorkingDay(calendar, '2026-10-24')).toBe('2026-10-26');
    expect(nextWorkingDay(calendar, '2026-10-25')).toBe('2026-10-26');
  });

  it('previousWorkingDay mundur ke hari kerja terakhir', () => {
    expect(previousWorkingDay(calendar, '2026-10-25')).toBe('2026-10-23');
    expect(previousWorkingDay(calendar, '2026-10-26')).toBe('2026-10-26');
  });

  it('shiftWorkingDays menggeser sejumlah hari kerja', () => {
    expect(shiftWorkingDays(calendar, '2026-10-23', 0)).toBe('2026-10-23');
    expect(shiftWorkingDays(calendar, '2026-10-23', 1)).toBe('2026-10-26');
    expect(shiftWorkingDays(calendar, '2026-10-23', 2)).toBe('2026-10-27');
    expect(shiftWorkingDays(calendar, '2026-10-23', 3)).toBe('2026-10-28');
    expect(shiftWorkingDays(calendar, '2026-10-27', -2)).toBe('2026-10-23');
  });

  it('shiftWorkingDays menghormati hari libur', () => {
    const withHoliday = createCalendar([0, 6], ['2026-10-26']);
    expect(shiftWorkingDays(withHoliday, '2026-10-23', 1)).toBe('2026-10-27');
    expect(shiftWorkingDays(withHoliday, '2026-10-23', 2)).toBe('2026-10-28');
  });

  it('workingDaysBetween menghitung hari kerja secara inklusif', () => {
    expect(workingDaysBetween(calendar, '2026-10-23', '2026-10-23')).toBe(1);
    expect(workingDaysBetween(calendar, '2026-10-23', '2026-10-27')).toBe(3);
    expect(workingDaysBetween(calendar, '2026-10-23', '2026-10-28')).toBe(4);
    expect(workingDaysBetween(calendar, '2026-10-24', '2026-10-25')).toBe(0);
    expect(workingDaysBetween(calendar, '2026-10-27', '2026-10-23')).toBe(0);
  });

  it('memvalidasi daftar hari akhir pekan', () => {
    expect(validateWeekendDays([0, 6])).toBeNull();
    expect(validateWeekendDays([])).toBeNull();
    expect(validateWeekendDays([0, 1, 2, 3, 4, 5, 6])).toMatch(/ketujuh hari/);
    expect(validateWeekendDays([7])).toMatch(/0 \(Minggu\) sampai 6/);
    expect(validateWeekendDays([0, 0])).toMatch(/tidak boleh berulang/);
    expect(() => createCalendar([0, 1, 2, 3, 4, 5, 6])).toThrow(/ketujuh hari/);
  });

  it('menyimpan dan membaca akhir pekan dari kolom teks', () => {
    expect(serializeWeekendDays([6, 0])).toBe('0,6');
    expect(parseWeekendDays('0,6')).toEqual([0, 6]);
    expect(parseWeekendDays('5')).toEqual([5]);
    expect(parseWeekendDays(null)).toEqual([0, 6]);
    expect(parseWeekendDays('')).toEqual([0, 6]);
  });
});
