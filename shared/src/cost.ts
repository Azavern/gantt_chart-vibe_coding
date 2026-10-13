import { isWorkingDay, type ProjectCalendar } from './calendar';
import { compareISODate } from './dates';
import { getLeafTasks, type SchedulableTask, type ScheduledTask } from './scheduler';

/**
 * Biaya dan beban kerja (blueprint 6.10).
 * Tarif harian = gaji bulanan / 22 hari kerja.
 */

export const WORKING_DAYS_PER_MONTH = 22;

export interface CostTaskLike extends ScheduledTask<SchedulableTask> {
  name: string;
}

export interface CostAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface CostResource {
  id: string;
  name: string;
  salary: number;
}

export interface OverAllocation {
  resourceId: string;
  resourceName: string;
  date: string;
  totalPercent: number;
  taskIds: string[];
}

/** Tarif harian seorang anggota tim (rupiah). */
export function dailyRate(salary: number): number {
  return salary / WORKING_DAYS_PER_MONTH;
}

/** Biaya satu tugas: jumlah dari tarif harian x durasi x persen alokasi. */
export function taskCost(task: CostTaskLike, assignments: CostAssignment[], resources: CostResource[]): number {
  const rates = new Map(resources.map((resource) => [resource.id, dailyRate(resource.salary)]));

  return assignments
    .filter((assignment) => assignment.taskId === task.id)
    .reduce((total, assignment) => {
      const rate = rates.get(assignment.resourceId);
      if (rate === undefined) return total;
      return total + rate * task.durationDays * (assignment.allocationPercent / 100);
    }, 0);
}

/** Total biaya proyek: jumlah biaya seluruh tugas daun. */
export function projectCost(
  tasks: CostTaskLike[],
  assignments: CostAssignment[],
  resources: CostResource[],
): number {
  return getLeafTasks(tasks).reduce(
    (total, task) => total + taskCost(task, assignments, resources),
    0,
  );
}

export interface ResourceCostSummary {
  resourceId: string;
  totalCost: number;
}

export function costByResource(
  tasks: CostTaskLike[],
  assignments: CostAssignment[],
  resources: CostResource[],
): ResourceCostSummary[] {
  const leaves = getLeafTasks(tasks);

  return resources.map((resource) => ({
    resourceId: resource.id,
    totalCost: leaves.reduce((total, task) => {
      const assignment = assignments.find(
        (candidate) => candidate.taskId === task.id && candidate.resourceId === resource.id,
      );
      if (!assignment) return total;

      return total + dailyRate(resource.salary) * task.durationDays * (assignment.allocationPercent / 100);
    }, 0),
  }));
}

/**
 * Peringatan over-alokasi: total alokasi seorang anggota melebihi 100% pada
 * hari kerja yang sama karena tugas-tugasnya saling tumpang tindih.
 */
export function findOverAllocations(
  tasks: CostTaskLike[],
  assignments: CostAssignment[],
  resources: CostResource[],
  calendar: ProjectCalendar,
): OverAllocation[] {
  const leaves = getLeafTasks(tasks);
  const taskById = new Map(leaves.map((task) => [task.id, task]));
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

  const perResourceDay = new Map<string, { total: number; taskIds: Set<string> }>();

  for (const assignment of assignments) {
    const task = taskById.get(assignment.taskId);
    if (!task) continue;

    let current = task.scheduledStart;
    while (compareISODate(current, task.scheduledEnd) <= 0) {
      if (isWorkingDay(calendar, current)) {
        const key = `${assignment.resourceId}|${current}`;
        const bucket = perResourceDay.get(key);
        if (bucket) {
          bucket.total += assignment.allocationPercent;
          bucket.taskIds.add(task.id);
        } else {
          perResourceDay.set(key, {
            total: assignment.allocationPercent,
            taskIds: new Set([task.id]),
          });
        }
      }

      const next = new Date(`${current}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      current = next.toISOString().slice(0, 10);
    }
  }

  const warnings: OverAllocation[] = [];
  for (const [key, bucket] of perResourceDay) {
    if (bucket.total <= 100) continue;

    const [resourceId, date] = key.split('|');
    warnings.push({
      resourceId,
      resourceName: resourceById.get(resourceId)?.name ?? resourceId,
      date,
      totalPercent: bucket.total,
      taskIds: Array.from(bucket.taskIds),
    });
  }

  return warnings.sort(
    (a, b) =>
      a.resourceName.localeCompare(b.resourceName) || compareISODate(a.date, b.date),
  );
}

/** Format rupiah tanpa bergantung pada data lokal sistem: `Rp 1.250.000`. */
export function formatIDR(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return `${sign}Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
