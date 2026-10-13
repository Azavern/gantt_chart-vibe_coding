import { describe, expect, it } from 'vitest';

import { buildPert, expectedTime, timeVariance } from './pert';
import { recomputeSchedule } from './scheduler';
import { makeDependency, makeTask, weekendCalendar, type TaskFixture } from './testing';

const calendar = weekendCalendar();
const projectStart = '2026-10-19';

function chain(): TaskFixture[] {
  return [
    makeTask({
      id: 'A',
      name: 'Rancangan',
      durationDays: 3,
      startDate: projectStart,
      optimisticDays: 2,
      pessimisticDays: 5,
    }),
    makeTask({
      id: 'B',
      name: 'Implementasi',
      durationDays: 4,
      startDate: projectStart,
      optimisticDays: 3,
      pessimisticDays: 6,
    }),
    makeTask({ id: 'C', name: 'Pengujian', durationDays: 5, startDate: projectStart }),
  ];
}

const dependencies = [makeDependency('A', 'B'), makeDependency('B', 'C')];

describe('pert - estimasi tiga titik', () => {
  it('menghitung te = (o + 4m + p) / 6', () => {
    expect(expectedTime(3, 2, 5)).toBeCloseTo(19 / 6, 5);
    expect(expectedTime(3, null, 5)).toBeNull();
  });

  it('menghitung variansi ((p - o) / 6)^2', () => {
    expect(timeVariance(2, 5)).toBeCloseTo(0.25, 5);
    expect(timeVariance(null, 5)).toBeNull();
  });
});

describe('pert - jaringan activity-on-node', () => {
  const scheduled = recomputeSchedule(chain(), dependencies, calendar);
  const result = buildPert(scheduled, dependencies, calendar, projectStart);

  it('menampilkan ES, EF, LS, LF, dan slack untuk tiap node', () => {
    const a = result.nodes.find((node) => node.taskId === 'A');
    expect(a).toMatchObject({ es: 0, ef: 2, ls: 0, lf: 2, slack: 0, critical: true, column: 0 });
  });

  it('menata kolom menurut kedalaman jalur terpanjang', () => {
    expect(result.nodes.map((node) => [node.taskId, node.column])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ]);
  });

  it('menandai node dan panah jalur kritis', () => {
    expect(result.criticalPath).toEqual(['A', 'B', 'C']);
    expect(result.nodes.every((node) => node.critical)).toBe(true);
    expect(result.edges.map((edge) => edge.critical)).toEqual([true, true]);
  });

  it('menghitung total variansi dan simpangan baku sepanjang jalur kritis', () => {
    expect(result.totalVariance).toBeCloseTo(0.5, 5);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(0.5), 5);
    expect(result.expectedDuration).toBeCloseTo(44 / 6, 5);
  });

  it('mengembalikan null bila estimasi tidak lengkap', () => {
    const withoutEstimates = recomputeSchedule(
      [makeTask({ id: 'A', durationDays: 2, startDate: projectStart })],
      [],
      calendar,
    );
    const single = buildPert(withoutEstimates, [], calendar, projectStart);

    expect(single.totalVariance).toBeNull();
    expect(single.standardDeviation).toBeNull();
    expect(single.expectedDuration).toBeNull();
    expect(single.nodes[0].te).toBeNull();
  });

  it('tidak menandai panah dan node kritis bila masih ada kelonggaran', () => {
    const tasks = [
      makeTask({ id: 'A', durationDays: 2, startDate: projectStart }),
      makeTask({ id: 'B', durationDays: 1, startDate: projectStart }),
      makeTask({ id: 'C', durationDays: 10, startDate: projectStart }),
    ];
    const withLag = [makeDependency('A', 'B', 'FS', 5)];
    const scheduledWithLag = recomputeSchedule(tasks, withLag, calendar);
    const lagged = buildPert(scheduledWithLag, withLag, calendar, projectStart);

    // C menentukan akhir proyek, sehingga A dan B memiliki float 2 meski batas FS-nya rapat.
    expect(lagged.edges[0].critical).toBe(false);
    expect(lagged.nodes.find((node) => node.taskId === 'B')?.critical).toBe(false);
    expect(lagged.nodes.find((node) => node.taskId === 'A')?.slack).toBe(2);
    expect(lagged.criticalPath).toEqual(['C']);
  });
});
