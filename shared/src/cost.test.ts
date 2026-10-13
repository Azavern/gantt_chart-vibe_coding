import { describe, expect, it } from 'vitest';

import { costByResource, dailyRate, findOverAllocations, formatIDR, projectCost, taskCost } from './cost';
import { recomputeSchedule } from './scheduler';
import { makeDependency, makeTask, weekendCalendar, type TaskFixture } from './testing';

const calendar = weekendCalendar();
const projectStart = '2026-10-19';

const resources = [
  { id: 'r1', name: 'Andi', salary: 22_000_000 },
  { id: 'r2', name: 'Budi', salary: 11_000_000 },
];

describe('cost', () => {
  it('menghitung tarif harian = gaji / 22', () => {
    expect(dailyRate(22_000_000)).toBe(1_000_000);
    expect(dailyRate(11_000_000)).toBe(500_000);
  });

  it('menghitung biaya tugas dari durasi dan persen alokasi', () => {
    const tasks = recomputeSchedule(
      [makeTask({ id: 'A', durationDays: 5, startDate: projectStart })],
      [],
      calendar,
    );
    const assignments = [
      { id: 'a1', taskId: 'A', resourceId: 'r1', allocationPercent: 50 },
      { id: 'a2', taskId: 'A', resourceId: 'r2', allocationPercent: 100 },
    ];

    // 1.000.000 x 5 x 50% + 500.000 x 5 x 100% = 2.500.000 + 2.500.000
    expect(taskCost(tasks[0], assignments, resources)).toBe(5_000_000);
  });

  it('menjumlahkan biaya hanya dari tugas daun', () => {
    const tasks: TaskFixture[] = [
      makeTask({ id: 'P', name: 'Induk', durationDays: 1, startDate: projectStart }),
      makeTask({ id: 'A', parentId: 'P', position: 1, durationDays: 4, startDate: projectStart }),
      makeTask({ id: 'B', parentId: 'P', position: 2, durationDays: 2, startDate: projectStart }),
    ];
    const scheduled = recomputeSchedule(tasks, [], calendar);
    const assignments = [
      { id: 'a1', taskId: 'A', resourceId: 'r1', allocationPercent: 100 },
      { id: 'a2', taskId: 'B', resourceId: 'r2', allocationPercent: 100 },
    ];

    // A: 1.000.000 x 4 = 4.000.000, B: 500.000 x 2 = 1.000.000
    expect(projectCost(scheduled, assignments, resources)).toBe(5_000_000);
    expect(costByResource(scheduled, assignments, resources)).toEqual([
      { resourceId: 'r1', totalCost: 4_000_000 },
      { resourceId: 'r2', totalCost: 1_000_000 },
    ]);
  });

  it('mendeteksi over-alokasi pada hari kerja yang tumpang tindih', () => {
    const tasks = recomputeSchedule(
      [
        makeTask({ id: 'A', durationDays: 3, startDate: projectStart }),
        makeTask({ id: 'B', durationDays: 3, startDate: projectStart }),
      ],
      [],
      calendar,
    );
    const assignments = [
      { id: 'a1', taskId: 'A', resourceId: 'r1', allocationPercent: 60 },
      { id: 'a2', taskId: 'B', resourceId: 'r1', allocationPercent: 60 },
    ];

    const warnings = findOverAllocations(tasks, assignments, resources, calendar);

    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatchObject({ resourceId: 'r1', resourceName: 'Andi', totalPercent: 120 });
    expect(warnings[0].taskIds.sort()).toEqual(['A', 'B']);
  });

  it('tidak memperingatkan bila tugas tidak tumpang tindih atau total <= 100', () => {
    const tasks = recomputeSchedule(
      [
        makeTask({ id: 'A', durationDays: 3, startDate: projectStart }),
        makeTask({ id: 'B', durationDays: 2, startDate: projectStart }),
      ],
      [makeDependency('A', 'B', 'FS')],
      calendar,
    );
    const assignments = [
      { id: 'a1', taskId: 'A', resourceId: 'r1', allocationPercent: 50 },
      { id: 'a2', taskId: 'B', resourceId: 'r1', allocationPercent: 50 },
    ];

    expect(findOverAllocations(tasks, assignments, resources, calendar)).toEqual([]);
  });

  it('memformat rupiah menurut aturan Indonesia', () => {
    expect(formatIDR(1_250_000)).toBe('Rp 1.250.000');
    expect(formatIDR(3_250_000.6)).toBe('Rp 3.250.001');
    expect(formatIDR(0)).toBe('Rp 0');
    expect(formatIDR(-1500)).toBe('-Rp 1.500');
  });
});
