import { describe, expect, it } from 'vitest';

import {
  addDays,
  compareISODate,
  dayOfWeek,
  diffInDays,
  eachDay,
  formatISODate,
  isValidISODate,
  maxISODate,
  minISODate,
  parseISODate,
} from './dates';

describe('dates', () => {
  it('memproses tanggal sebagai UTC murni tanpa pergeseran hari', () => {
    const date = parseISODate('2026-10-23');
    expect(date.toISOString()).toBe('2026-10-23T00:00:00.000Z');
    expect(date.getUTCHours()).toBe(0);
  });

  it('bolak-balik format tanggal tetap sama', () => {
    expect(formatISODate(parseISODate('2026-01-01'))).toBe('2026-01-01');
    expect(formatISODate(parseISODate('2026-12-31'))).toBe('2026-12-31');
  });

  it('menolak format dan tanggal yang tidak valid', () => {
    expect(() => parseISODate('23-10-2026')).toThrow(/format YYYY-MM-DD/);
    expect(() => parseISODate('2026-02-30')).toThrow(/tidak ada di kalender/);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
  });

  it('menambah dan mengurangi hari kalender', () => {
    expect(addDays('2026-10-23', 4)).toBe('2026-10-27');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('menghitung selisih hari kalender', () => {
    expect(diffInDays('2026-10-19', '2026-10-23')).toBe(4);
    expect(diffInDays('2026-10-23', '2026-10-19')).toBe(-4);
  });

  it('menentukan hari dalam minggu (0 = Minggu)', () => {
    expect(dayOfWeek('2026-10-23')).toBe(5);
    expect(dayOfWeek('2026-10-24')).toBe(6);
    expect(dayOfWeek('2026-10-25')).toBe(0);
    expect(dayOfWeek('2026-10-26')).toBe(1);
  });

  it('membandingkan dan memilih tanggal ekstrem', () => {
    expect(compareISODate('2026-10-19', '2026-10-20')).toBe(-1);
    expect(compareISODate('2026-10-20', '2026-10-20')).toBe(0);
    expect(compareISODate('2026-10-21', '2026-10-20')).toBe(1);
    expect(maxISODate('2026-10-19', '2026-10-20')).toBe('2026-10-20');
    expect(minISODate('2026-10-19', '2026-10-20')).toBe('2026-10-19');
  });

  it('mengembalikan rentang hari inklusif', () => {
    expect(eachDay('2026-10-23', '2026-10-26')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
  });
});
