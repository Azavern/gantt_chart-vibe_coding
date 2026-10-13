import {
  createCalendar,
  recomputeSchedule,
  type AssignmentDto,
  type DependencyDto,
  type HolidayDto,
  type ProjectDto,
  type ResourceDto,
  type TaskDto,
} from '@gantt/shared';

/**
 * Data uji yang menyerupai hasil seed (blueprint bagian 9), dijadwalkan dengan
 * mesin `shared` supaya nilai tanggalnya pasti konsisten.
 */

export const PROJECT_START = '2026-10-19';

interface TaskSeed {
  id: string;
  parentId: string | null;
  position: number;
  name: string;
  durationDays: number;
  progress: number;
  color: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  optimisticDays?: number;
  pessimisticDays?: number;
}

const TASK_SEEDS: TaskSeed[] = [
  { id: 'p1', parentId: null, position: 1, name: 'Perencanaan', durationDays: 1, progress: 0, color: '#0F766E', priority: 'HIGH' },
  { id: 't11', parentId: 'p1', position: 1, name: 'Kickoff dan kebutuhan', durationDays: 3, progress: 100, color: '#0F766E', priority: 'HIGH' },
  { id: 't12', parentId: 'p1', position: 2, name: 'Penyusunan spesifikasi', durationDays: 4, progress: 50, color: '#0F766E', priority: 'HIGH' },
  { id: 'p2', parentId: null, position: 2, name: 'Pengembangan', durationDays: 1, progress: 0, color: '#1D4ED8', priority: 'HIGH' },
  { id: 't21', parentId: 'p2', position: 1, name: 'Implementasi backend', durationDays: 10, progress: 0, color: '#1D4ED8', priority: 'HIGH', optimisticDays: 8, pessimisticDays: 15 },
  { id: 't22', parentId: 'p2', position: 2, name: 'Implementasi frontend', durationDays: 12, progress: 0, color: '#1D4ED8', priority: 'HIGH' },
];

const DEPENDENCY_SEEDS: Array<{ id: string; predecessorId: string; successorId: string; type: 'FS' | 'SS'; lagDays: number }> = [
  { id: 'd1', predecessorId: 't11', successorId: 't12', type: 'FS', lagDays: 0 },
  { id: 'd2', predecessorId: 't12', successorId: 't21', type: 'FS', lagDays: 0 },
  { id: 'd3', predecessorId: 't21', successorId: 't22', type: 'SS', lagDays: 2 },
];

export interface Fixture {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
  calendar: ReturnType<typeof createCalendar>;
}

export function buildFixture(): Fixture {
  const holidays: HolidayDto[] = [
    { id: 'h1', projectId: 'project-1', date: '2026-10-26', name: 'Cuti bersama' },
  ];

  const project: ProjectDto = {
    id: 'project-1',
    ownerId: 'user-1',
    name: 'Pengembangan Aplikasi Mobile Toko Online',
    description: 'Proyek contoh untuk pengujian komponen.',
    startDate: PROJECT_START,
    weekendDays: [0, 6],
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const calendar = createCalendar(project.weekendDays, holidays.map((holiday) => holiday.date));

  const rawTasks = TASK_SEEDS.map<TaskDto>((seed) => ({
    id: seed.id,
    projectId: project.id,
    parentId: seed.parentId,
    position: seed.position,
    name: seed.name,
    description: null,
    durationDays: seed.durationDays,
    startDate: PROJECT_START,
    scheduledStart: PROJECT_START,
    scheduledEnd: PROJECT_START,
    priority: seed.priority,
    color: seed.color,
    progress: seed.progress,
    optimisticDays: seed.optimisticDays ?? null,
    pessimisticDays: seed.pessimisticDays ?? null,
  }));

  const resources: ResourceDto[] = [
    { id: 'r1', projectId: project.id, name: 'Andi Pratama', email: 'andi@example.com', role: 'Project Manager', salary: 15_000_000 },
    { id: 'r2', projectId: project.id, name: 'Budi Santoso', email: 'budi@example.com', role: 'Backend Developer', salary: 12_000_000 },
  ];

  const assignments: AssignmentDto[] = [
    { id: 'a1', taskId: 't11', resourceId: 'r1', allocationPercent: 100 },
    { id: 'a2', taskId: 't21', resourceId: 'r2', allocationPercent: 50 },
    { id: 'a3', taskId: 't22', resourceId: 'r2', allocationPercent: 50 },
  ];

  const tasks = recomputeSchedule(rawTasks, DEPENDENCY_SEEDS, calendar) as TaskDto[];

  return {
    project,
    tasks,
    dependencies: DEPENDENCY_SEEDS,
    resources,
    assignments,
    holidays,
    calendar,
  };
}

export function taskById(fixture: Fixture, id: string): TaskDto {
  const task = fixture.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Tugas ${id} tidak ada pada fixture`);
  return task;
}
