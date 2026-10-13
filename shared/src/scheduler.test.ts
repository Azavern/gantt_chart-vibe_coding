import { describe, expect, it } from 'vitest';

import { createCalendar, workingDaysBetween } from './calendar';
import {
  ScheduleError,
  computeTaskDepth,
  findCycle,
  getLeafTasks,
  recomputeSchedule,
  wouldCreateCycle,
  type DependencyLink,
  type ScheduledTask,
} from './scheduler';
import { makeDependency, makeTask, weekendCalendar, type TaskFixture } from './testing';

const calendar = weekendCalendar();

function schedule(
  tasks: TaskFixture[],
  dependencies: DependencyLink[] = [],
): ScheduledTask<TaskFixture>[] {
  return recomputeSchedule(tasks, dependencies, calendar);
}

function byId(tasks: ScheduledTask<TaskFixture>[], id: string): ScheduledTask<TaskFixture> {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Tugas ${id} tidak ditemukan`);
  return task;
}

describe('scheduler - vektor uji blueprint 6.11', () => {
  it('mulai Jumat 2026-10-23 durasi 3 hari berakhir Selasa 2026-10-27', () => {
    const result = schedule([makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 })]);

    expect(byId(result, 'A').scheduledStart).toBe('2026-10-23');
    expect(byId(result, 'A').scheduledEnd).toBe('2026-10-27');
  });

  it('FS lag 0 memulai penerus pada Rabu 2026-10-28', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'B', startDate: '2026-10-23', durationDays: 2 }),
    ];
    const result = schedule(tasks, [makeDependency('A', 'B', 'FS', 0)]);

    expect(byId(result, 'B').scheduledStart).toBe('2026-10-28');
    expect(byId(result, 'B').scheduledEnd).toBe('2026-10-29');
  });

  it('SS lag 2 memulai penerus pada Selasa 2026-10-27', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'B', startDate: '2026-10-23', durationDays: 2 }),
    ];
    const result = schedule(tasks, [makeDependency('A', 'B', 'SS', 2)]);

    expect(byId(result, 'B').scheduledStart).toBe('2026-10-27');
    expect(byId(result, 'B').scheduledEnd).toBe('2026-10-28');
  });

  it('dengan libur Senin 2026-10-26 durasi 3 hari berakhir Rabu 2026-10-28', () => {
    const holidayCalendar = createCalendar([0, 6], ['2026-10-26']);
    const result = recomputeSchedule(
      [makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 })],
      [],
      holidayCalendar,
    );

    expect(byId(result, 'A').scheduledStart).toBe('2026-10-23');
    expect(byId(result, 'A').scheduledEnd).toBe('2026-10-28');
    expect(workingDaysBetween(holidayCalendar, '2026-10-23', '2026-10-28')).toBe(3);
  });
});

describe('scheduler - dependensi', () => {
  it('startDate berfungsi sebagai batas mulai paling awal', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'B', startDate: '2026-11-02', durationDays: 1 }),
    ];
    const result = schedule(tasks, [makeDependency('A', 'B', 'FS', 0)]);

    expect(byId(result, 'B').scheduledStart).toBe('2026-11-02');
  });

  it('batas predecessor menang bila startDate lebih awal', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'B', startDate: '2026-10-01', durationDays: 1 }),
    ];
    const result = schedule(tasks, [makeDependency('A', 'B', 'FS', 0)]);

    expect(byId(result, 'B').scheduledStart).toBe('2026-10-28');
  });

  it('memakai batas paling akhir dari beberapa predecessor', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-19', durationDays: 2 }),
      makeTask({ id: 'B', startDate: '2026-10-19', durationDays: 5 }),
      makeTask({ id: 'C', startDate: '2026-10-19', durationDays: 1 }),
    ];
    const result = schedule(tasks, [makeDependency('A', 'C', 'FS'), makeDependency('B', 'C', 'FS')]);

    expect(byId(result, 'B').scheduledEnd).toBe('2026-10-23');
    expect(byId(result, 'C').scheduledStart).toBe('2026-10-26');
  });

  it('mendukung lag negatif dan lag positip dalam hari kerja', () => {
    const tasks = [
      makeTask({ id: 'A', startDate: '2026-10-19', durationDays: 5 }),
      makeTask({ id: 'B', startDate: '2026-10-19', durationDays: 1 }),
      makeTask({ id: 'C', startDate: '2026-10-19', durationDays: 1 }),
    ];
    const result = schedule(tasks, [
      makeDependency('A', 'B', 'FS', -2),
      makeDependency('A', 'C', 'FS', 3),
    ]);

    expect(byId(result, 'A').scheduledEnd).toBe('2026-10-23');
    expect(byId(result, 'B').scheduledStart).toBe('2026-10-22');
    expect(byId(result, 'C').scheduledStart).toBe('2026-10-29');
  });

  it('menggeser tanggal mulai ke hari kerja berikutnya', () => {
    const result = schedule([makeTask({ id: 'A', startDate: '2026-10-24', durationDays: 2 })]);

    expect(byId(result, 'A').scheduledStart).toBe('2026-10-26');
    expect(byId(result, 'A').scheduledEnd).toBe('2026-10-27');
  });
});

describe('scheduler - tugas induk', () => {
  const tasks = [
    makeTask({ id: 'P', name: 'Induk', durationDays: 1, startDate: '2026-10-19' }),
    makeTask({ id: 'A', parentId: 'P', position: 1, durationDays: 3, progress: 100, startDate: '2026-10-19' }),
    makeTask({ id: 'B', parentId: 'P', position: 2, durationDays: 5, progress: 0, startDate: '2026-10-26' }),
  ];

  it('menghitung rentang dan durasi induk dari anak-anaknya', () => {
    const result = schedule(tasks);
    const parent = byId(result, 'P');

    expect(parent.scheduledStart).toBe('2026-10-19');
    expect(parent.scheduledEnd).toBe('2026-10-30');
    expect(parent.durationDays).toBe(workingDaysBetween(calendar, '2026-10-19', '2026-10-30'));
  });

  it('menghitung progres induk berbobot durasi anak', () => {
    const result = schedule(tasks);

    // (100 x 3 + 0 x 5) / 8 = 37,5 -> 38
    expect(byId(result, 'P').progress).toBe(38);
  });

  it('hanya tugas daun yang dianggap tugas terjadwal', () => {
    expect(getLeafTasks(tasks).map((task) => task.id)).toEqual(['A', 'B']);
  });

  it('menghitung kedalaman struktur tugas', () => {
    const nested = [
      makeTask({ id: 'L1' }),
      makeTask({ id: 'L2', parentId: 'L1' }),
      makeTask({ id: 'L3', parentId: 'L2' }),
    ];
    const depths = computeTaskDepth(nested);

    expect(depths.get('L1')).toBe(1);
    expect(depths.get('L2')).toBe(2);
    expect(depths.get('L3')).toBe(3);
  });

  it('mengabaikan dependensi yang menyentuh tugas induk', () => {
    const result = schedule(
      [...tasks, makeTask({ id: 'Z', durationDays: 1, startDate: '2026-10-19' })],
      [makeDependency('P', 'Z', 'FS', 0)],
    );

    expect(byId(result, 'Z').scheduledStart).toBe('2026-10-19');
  });
});

describe('scheduler - siklus', () => {
  const tasks = [
    makeTask({ id: 'A', durationDays: 2 }),
    makeTask({ id: 'B', durationDays: 2 }),
    makeTask({ id: 'C', durationDays: 2 }),
  ];

  it('menolak jadwal yang membentuk siklus dengan kode CYCLE_DETECTED', () => {
    const dependencies = [
      makeDependency('A', 'B'),
      makeDependency('B', 'C'),
      makeDependency('C', 'A'),
    ];

    try {
      recomputeSchedule(tasks, dependencies, calendar);
      throw new Error('seharusnya melempar ScheduleError');
    } catch (error) {
      expect(error).toBeInstanceOf(ScheduleError);
      expect((error as ScheduleError).code).toBe('CYCLE_DETECTED');
    }
  });

  it('mendeteksi dependensi baru yang akan membentuk siklus', () => {
    const existing = [makeDependency('A', 'B'), makeDependency('B', 'C')];

    expect(wouldCreateCycle(existing, { from: 'C', to: 'A' })).toBe(true);
    expect(wouldCreateCycle(existing, { from: 'A', to: 'C' })).toBe(false);
    expect(findCycle([{ from: 'A', to: 'A' }])).toEqual(['A', 'A']);
    expect(findCycle([{ from: 'A', to: 'B' }])).toBeNull();
  });
});
