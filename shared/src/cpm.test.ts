import { describe, expect, it } from 'vitest';

import { computeCpm, workdayOrdinal } from './cpm';
import { recomputeSchedule } from './scheduler';
import { makeDependency, makeTask, weekendCalendar, type TaskFixture } from './testing';

const calendar = weekendCalendar();
const projectStart = '2026-10-19';

/**
 * Vektor uji CPM (blueprint 6.11): A(3) -> B(2), A -> C(5), B dan C -> D(1),
 * semua FS lag 0, proyek mulai Senin 2026-10-19.
 * Hasil yang diharapkan: A, C, D kritis; B float 3; PE = 8.
 */
function vectorTasks(): TaskFixture[] {
  return [
    makeTask({ id: 'A', durationDays: 3, startDate: projectStart }),
    makeTask({ id: 'B', durationDays: 2, startDate: projectStart }),
    makeTask({ id: 'C', durationDays: 5, startDate: projectStart }),
    makeTask({ id: 'D', durationDays: 1, startDate: projectStart }),
  ];
}

const vectorDependencies = [
  makeDependency('A', 'B'),
  makeDependency('A', 'C'),
  makeDependency('B', 'D'),
  makeDependency('C', 'D'),
];

describe('cpm - vektor uji blueprint 6.11', () => {
  const scheduled = recomputeSchedule(vectorTasks(), vectorDependencies, calendar);
  const result = computeCpm(scheduled, vectorDependencies, calendar, projectStart);

  it('menghasilkan akhir proyek PE = 8', () => {
    expect(result.projectEnd).toBe(8);
  });

  it('menandai A, C, dan D sebagai kritis', () => {
    expect(result.criticalTaskIds.sort()).toEqual(['A', 'C', 'D']);
  });

  it('memberi B total float 3', () => {
    const b = result.byTaskId.get('B');
    expect(b?.totalFloat).toBe(3);
    expect(b?.critical).toBe(false);
    expect(b?.es).toBe(3);
    expect(b?.ef).toBe(4);
    expect(b?.ls).toBe(6);
    expect(b?.lf).toBe(7);
  });

  it('menyusun jalur kritis terurut menurut ES', () => {
    expect(result.criticalPath).toEqual(['A', 'C', 'D']);
  });

  it('menghitung ordinal hari kerja terhadap awal proyek', () => {
    expect(workdayOrdinal(calendar, projectStart, '2026-10-19')).toBe(0);
    expect(workdayOrdinal(calendar, projectStart, '2026-10-23')).toBe(4);
    expect(workdayOrdinal(calendar, projectStart, '2026-10-26')).toBe(5);
    expect(workdayOrdinal(calendar, projectStart, '2026-10-18')).toBe(-1);
  });
});

describe('cpm - kasus lain', () => {
  it('menghitung float pada rantaian sederhana', () => {
    const tasks = [
      makeTask({ id: 'A', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'B', durationDays: 6, startDate: projectStart }),
    ];
    const scheduled = recomputeSchedule(tasks, [], calendar);
    const result = computeCpm(scheduled, [], calendar, projectStart);

    expect(result.projectEnd).toBe(5);
    expect(result.byTaskId.get('A')?.totalFloat).toBe(4);
    expect(result.criticalTaskIds).toEqual(['B']);
  });

  it('mengembalikan hasil kosong bila proyek belum punya tugas', () => {
    const result = computeCpm([], [], calendar, projectStart);

    expect(result.nodes).toEqual([]);
    expect(result.criticalPath).toEqual([]);
    expect(result.projectEnd).toBe(0);
  });

  it('menerapkan lag pada forward pass dan late finish (FS dan SS)', () => {
    const tasks = [
      makeTask({ id: 'A', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'B', durationDays: 3, startDate: projectStart }),
      makeTask({ id: 'C', durationDays: 1, startDate: projectStart }),
    ];
    const dependencies = [makeDependency('A', 'B', 'FS', 1), makeDependency('B', 'C', 'SS', 0)];
    const scheduled = recomputeSchedule(tasks, dependencies, calendar);
    const result = computeCpm(scheduled, dependencies, calendar, projectStart);

    // A: Senin 19 - Selasa 20 (ordinal 0-1), B mulai Kamis 22 karena FS lag 1 (ordinal 3-5).
    expect(result.byTaskId.get('A')?.es).toBe(0);
    expect(result.byTaskId.get('A')?.ef).toBe(1);
    expect(result.byTaskId.get('B')?.es).toBe(3);
    expect(result.byTaskId.get('B')?.ef).toBe(5);
    expect(result.byTaskId.get('C')?.es).toBe(3);
    expect(result.projectEnd).toBe(5);

    // Menurut rumus 6.8, penerus dengan SS saja tidak membatasi akhir predecessor,
    // sehingga seluruh tugas pada rantai ini memiliki float.
    expect(result.criticalTaskIds).toEqual([]);
  });

  it('memilih satu jalur kritis bila ada cabang yang sama panjang', () => {
    const tasks = [
      makeTask({ id: 'A', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'B', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'C', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'D', durationDays: 2, startDate: projectStart }),
    ];
    const dependencies = [makeDependency('A', 'B'), makeDependency('C', 'D')];
    const scheduled = recomputeSchedule(tasks, dependencies, calendar);
    const result = computeCpm(scheduled, dependencies, calendar, projectStart);

    expect(result.projectEnd).toBe(3);
    expect(result.criticalTaskIds.sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(result.criticalPath).toEqual(['A', 'B']);
  });
});
