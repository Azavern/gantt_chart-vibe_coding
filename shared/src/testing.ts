import type { ProjectCalendar } from './calendar';
import { createCalendar } from './calendar';
import type { DependencyLink, SchedulableTask } from './scheduler';
import type { DependencyType, Priority } from './types';

/**
 * Pembantu pembuatan data uji. File ini tidak ikut di-build (lihat tsconfig.build.json).
 */

export interface TaskFixture extends SchedulableTask {
  name: string;
  priority: Priority;
  color: string;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

let fixtureCounter = 0;

export function makeTask(overrides: Partial<TaskFixture> & { id: string }): TaskFixture {
  fixtureCounter += 1;

  return {
    parentId: null,
    position: fixtureCounter,
    durationDays: 1,
    startDate: '2026-10-19',
    progress: 0,
    name: overrides.id,
    priority: 'MEDIUM',
    color: '#0D9488',
    optimisticDays: null,
    pessimisticDays: null,
    ...overrides,
  };
}

export function makeDependency(
  predecessorId: string,
  successorId: string,
  type: DependencyType = 'FS',
  lagDays = 0,
): DependencyLink {
  return { predecessorId, successorId, type, lagDays };
}

export function weekendCalendar(holidays: string[] = []): ProjectCalendar {
  return createCalendar([0, 6], holidays);
}
