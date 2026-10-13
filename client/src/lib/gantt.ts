import {
  addDays,
  compareISODate,
  computeCpm,
  createCalendar,
  diffInDays,
  type AssignmentDto,
  type DependencyDto,
  type HolidayDto,
  type ProjectCalendar,
  type ProjectDto,
  type ResourceDto,
  type TaskDto,
} from '@gantt/shared';

/** Tinggi baris dipakai bersama tabel dan timeline agar keduanya sejajar. */
export const ROW_HEIGHT = 44;
export const HEADER_HEIGHT = 60;

export type ZoomLevel = 'day' | 'week' | 'month';

export const DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 34,
  week: 16,
  month: 7,
};

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Hari',
  week: 'Minggu',
  month: 'Bulan',
};

export interface GanttRow {
  task: TaskDto;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  /** Nomor WBS seperti 1, 1.2, atau 1.2.3. */
  wbs: string;
  assigneeNames: string[];
}

export function buildCalendar(project: ProjectDto, holidays: HolidayDto[]): ProjectCalendar {
  return createCalendar(project.weekendDays, holidays.map((holiday) => holiday.date));
}

/**
 * Menyusun baris tabel Gantt dalam urutan WBS, melewati anak dari induk yang dilipat.
 */
export function buildRows(
  tasks: TaskDto[],
  assignments: AssignmentDto[],
  resources: ResourceDto[],
  collapsed: Set<string>,
): GanttRow[] {
  const childrenByParent = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const siblings = childrenByParent.get(task.parentId);
    if (siblings) siblings.push(task);
    else childrenByParent.set(task.parentId, [task]);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }

  const resourceNames = new Map(resources.map((resource) => [resource.id, resource.name]));
  const rows: GanttRow[] = [];

  const visit = (parentId: string | null, prefix: string, depth: number): void => {
    for (const [index, task] of (childrenByParent.get(parentId) ?? []).entries()) {
      const wbs = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      const children = childrenByParent.get(task.id) ?? [];
      const isCollapsed = collapsed.has(task.id);

      rows.push({
        task,
        depth,
        hasChildren: children.length > 0,
        collapsed: isCollapsed,
        wbs,
        assigneeNames: assignments
          .filter((assignment) => assignment.taskId === task.id)
          .map((assignment) => resourceNames.get(assignment.resourceId) ?? '')
          .filter(Boolean),
      });

      if (!isCollapsed) visit(task.id, wbs, depth + 1);
    }
  };

  visit(null, '', 1);
  return rows;
}

export interface GanttRange {
  start: string;
  end: string;
  days: number;
}

/**
 * Rentang tanggal yang digambar: dari awal pekan tanggal paling awal sampai akhir
 * pekan tanggal paling akhir, minimal mencakup tanggal mulai proyek.
 */
export function computeRange(tasks: TaskDto[], project: ProjectDto): GanttRange {
  let min = project.startDate;
  let max = project.startDate;

  for (const task of tasks) {
    if (compareISODate(task.scheduledStart, min) < 0) min = task.scheduledStart;
    if (compareISODate(task.scheduledEnd, max) > 0) max = task.scheduledEnd;
  }

  // Selaraskan ke batas pekan (Minggu - Sabtu) lalu tambah satu pekan di kanan.
  const startDay = new Date(`${min}T00:00:00.000Z`).getUTCDay();
  const start = addDays(min, -startDay);
  const endDay = new Date(`${max}T00:00:00.000Z`).getUTCDay();
  const end = addDays(max, 6 - endDay + 7);

  return { start, end, days: diffInDays(start, end) + 1 };
}

export function xOfDate(date: string, rangeStart: string, dayWidth: number): number {
  return diffInDays(rangeStart, date) * dayWidth;
}

export function dateAtX(x: number, rangeStart: string, dayWidth: number): string {
  return addDays(rangeStart, Math.round(x / dayWidth));
}

/** Lebar bar menurut tanggal kalender sehingga bar melintasi akhir pekan. */
export function barWidth(task: TaskDto, dayWidth: number): number {
  return (diffInDays(task.scheduledStart, task.scheduledEnd) + 1) * dayWidth;
}

/** Id tugas kritis dari mesin CPM di paket `shared`. */
export function criticalTaskIds(
  tasks: TaskDto[],
  dependencies: DependencyDto[],
  calendar: ProjectCalendar,
  projectStartDate: string,
): Set<string> {
  if (tasks.length === 0) return new Set();

  try {
    const result = computeCpm(tasks, dependencies, calendar, projectStartDate);
    return new Set(result.criticalTaskIds);
  } catch {
    // Bila data tidak konsisten (mis. siklus dari data lama), sorotan dimatikan.
    return new Set();
  }
}
