import { nextWorkingDay, shiftWorkingDays, workingDaysBetween, type ProjectCalendar } from './calendar';
import { maxISODate } from './dates';
import type { DependencyType } from './types';

/**
 * Mesin penjadwalan (blueprint 6.3 - 6.6). Fungsi murni: tidak menyentuh database
 * maupun waktu sistem, sehingga hasilnya identik di server dan di client.
 */

export interface SchedulableTask {
  id: string;
  parentId: string | null;
  position: number;
  /** Durasi hari kerja, bilah tetap digambar menurut tanggal kalender. */
  durationDays: number;
  /** Batas mulai paling awal yang diisi pengguna. */
  startDate: string;
  progress: number;
}

export interface ScheduledFields {
  scheduledStart: string;
  scheduledEnd: string;
  durationDays: number;
  progress: number;
}

export type ScheduledTask<T extends SchedulableTask> = T & ScheduledFields;

export interface DependencyLink {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

/** Kedalaman struktur tugas maksimal (blueprint 6.5). */
export const MAX_TASK_DEPTH = 3;

export type ScheduleErrorCode = 'CYCLE_DETECTED' | 'INVALID_SCHEDULE';

export class ScheduleError extends Error {
  readonly code: ScheduleErrorCode;

  constructor(code: ScheduleErrorCode, message: string) {
    super(message);
    this.name = 'ScheduleError';
    this.code = code;
  }
}

/** Mengelompokkan tugas menurut `parentId` dan mengurutkannya menurut `position`. */
export function groupByParent<T extends SchedulableTask>(tasks: T[]): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>();

  for (const task of tasks) {
    const siblings = groups.get(task.parentId);
    if (siblings) {
      siblings.push(task);
    } else {
      groups.set(task.parentId, [task]);
    }
  }

  for (const siblings of groups.values()) {
    siblings.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }

  return groups;
}

/**
 * Mengurutkan tugas dalam urutan WBS: induk sebelum anak, saudara menurut `position`.
 * Dipakai server saat mengirim daftar tugas dan client saat menggambar tabel Gantt.
 */
export function flattenTaskTree<T extends SchedulableTask>(tasks: T[]): T[] {
  const groups = groupByParent(tasks);
  const ordered: T[] = [];
  const visited = new Set<string>();

  const visit = (parentId: string | null): void => {
    for (const task of groups.get(parentId) ?? []) {
      if (visited.has(task.id)) continue;
      visited.add(task.id);
      ordered.push(task);
      visit(task.id);
    }
  };

  visit(null);

  // Tugas yang induknya hilang (data tidak konsisten) tetap ditampilkan di akhir.
  for (const task of tasks) {
    if (!visited.has(task.id)) ordered.push(task);
  }

  return ordered;
}

/** Tugas daun (tanpa anak) saja yang boleh punya dependensi dan assignment. */
export function getLeafTasks<T extends SchedulableTask>(tasks: T[]): T[] {
  const groups = groupByParent(tasks);
  return tasks.filter((task) => (groups.get(task.id) ?? []).length === 0);
}

export function isLeafTask<T extends SchedulableTask>(tasks: T[], taskId: string): boolean {
  return !tasks.some((task) => task.parentId === taskId);
}

/** Kedalaman 1 untuk tugas akar, 2 untuk anaknya, dan seterusnya. */
export function computeTaskDepth<T extends SchedulableTask>(tasks: T[]): Map<string, number> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const depths = new Map<string, number>();

  const resolve = (task: T, guard: Set<string>): number => {
    const cached = depths.get(task.id);
    if (cached !== undefined) return cached;
    if (!task.parentId || guard.has(task.id)) return 1;

    const parent = byId.get(task.parentId);
    if (!parent) return 1;

    guard.add(task.id);
    const depth = resolve(parent, guard) + 1;
    guard.delete(task.id);

    depths.set(task.id, depth);
    return depth;
  };

  for (const task of tasks) {
    depths.set(task.id, resolve(task, new Set<string>()));
  }

  return depths;
}

interface Edge {
  from: string;
  to: string;
}

/**
 * Mencari siklus pada graf dependensi. Mengembalikan rangkaian id pembentuk siklus
 * (mis. `[a, b, a]`) atau `null` bila tidak ada siklus.
 */
export function findCycle(edges: Edge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) return [edge.from, edge.to];
    const list = adjacency.get(edge.from);
    if (list) list.push(edge.to);
    else adjacency.set(edge.from, [edge.to]);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colors = new Map<string, number>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    colors.set(node, GRAY);
    stack.push(node);

    for (const next of adjacency.get(node) ?? []) {
      const color = colors.get(next) ?? WHITE;
      if (color === GRAY) {
        const startIndex = stack.indexOf(next);
        return [...stack.slice(startIndex), next];
      }
      if (color === WHITE) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }

    stack.pop();
    colors.set(node, BLACK);
    return null;
  };

  for (const node of adjacency.keys()) {
    if ((colors.get(node) ?? WHITE) === WHITE) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }

  return null;
}

export function toEdges(dependencies: DependencyLink[]): Edge[] {
  return dependencies.map((link) => ({ from: link.predecessorId, to: link.successorId }));
}

/** Apakah menambahkan dependensi `candidate` akan membentuk siklus? */
export function wouldCreateCycle(existing: DependencyLink[], candidate: Edge): boolean {
  return findCycle([...toEdges(existing), candidate]) !== null;
}

/**
 * Urutan topologis tugas daun memakai algoritma Kahn (blueprint 6.6).
 * Dependensi yang menyentuh tugas induk diabaikan (server menolaknya saat input).
 */
export function topologicallySortedLeaves<T extends SchedulableTask>(
  tasks: T[],
  dependencies: DependencyLink[],
): T[] {
  const leaves = getLeafTasks(tasks);
  const leafIds = new Set(leaves.map((task) => task.id));

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const leaf of leaves) {
    adjacency.set(leaf.id, []);
    indegree.set(leaf.id, 0);
  }

  for (const link of dependencies) {
    if (!leafIds.has(link.predecessorId) || !leafIds.has(link.successorId)) continue;
    if (link.predecessorId === link.successorId) continue;

    adjacency.get(link.predecessorId)?.push(link.successorId);
    indegree.set(link.successorId, (indegree.get(link.successorId) ?? 0) + 1);
  }

  const queue = leaves
    .filter((leaf) => (indegree.get(leaf.id) ?? 0) === 0)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((leaf) => leaf.id);

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);

    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== leaves.length) {
    throw new ScheduleError(
      'CYCLE_DETECTED',
      'Dependensi membentuk siklus sehingga jadwal tidak dapat dihitung.',
    );
  }

  const byId = new Map(leaves.map((leaf) => [leaf.id, leaf]));
  return order.map((id) => byId.get(id) as T);
}

function resolveStartDate<T extends SchedulableTask>(
  task: T,
  incoming: DependencyLink[],
  scheduled: Map<string, ScheduledTask<T>>,
  calendar: ProjectCalendar,
): string {
  let bound = task.startDate;

  for (const link of incoming) {
    const predecessor = scheduled.get(link.predecessorId);
    if (!predecessor) continue;

    const candidate =
      link.type === 'FS'
        ? shiftWorkingDays(calendar, predecessor.scheduledEnd, 1 + link.lagDays)
        : shiftWorkingDays(calendar, predecessor.scheduledStart, link.lagDays);

    bound = maxISODate(bound, candidate);
  }

  return nextWorkingDay(calendar, bound);
}

function weightedProgress<T extends SchedulableTask>(children: ScheduledTask<T>[]): number {
  const totalDuration = children.reduce((sum, child) => sum + child.durationDays, 0);
  if (totalDuration <= 0) {
    const average = children.reduce((sum, child) => sum + child.progress, 0) / children.length;
    return Math.round(average);
  }

  const weighted = children.reduce((sum, child) => sum + child.progress * child.durationDays, 0);
  return Math.round(weighted / totalDuration);
}

/**
 * Menghitung ulang seluruh jadwal proyek (blueprint 6.6):
 * urut topologis tugas daun, hitung `scheduledStart`/`scheduledEnd`,
 * lalu roll-up tugas induk dari bawah ke atas.
 */
export function recomputeSchedule<T extends SchedulableTask>(
  tasks: T[],
  dependencies: DependencyLink[],
  calendar: ProjectCalendar,
): ScheduledTask<T>[] {
  if (tasks.length === 0) return [];

  const scheduledLeaves = new Map<string, ScheduledTask<T>>();
  const incoming = new Map<string, DependencyLink[]>();
  for (const link of dependencies) {
    const list = incoming.get(link.successorId);
    if (list) list.push(link);
    else incoming.set(link.successorId, [link]);
  }

  for (const leaf of topologicallySortedLeaves(tasks, dependencies)) {
    if (leaf.durationDays < 1) {
      throw new ScheduleError(
        'INVALID_SCHEDULE',
        `Durasi tugas "${leaf.id}" harus minimal 1 hari kerja.`,
      );
    }

    const start = resolveStartDate(leaf, incoming.get(leaf.id) ?? [], scheduledLeaves, calendar);
    const end = shiftWorkingDays(calendar, start, leaf.durationDays - 1);

    scheduledLeaves.set(leaf.id, {
      ...leaf,
      scheduledStart: start,
      scheduledEnd: end,
      durationDays: leaf.durationDays,
      progress: leaf.progress,
    });
  }

  const groups = groupByParent(tasks);
  const result = new Map<string, ScheduledTask<T>>();

  const resolveSummary = (task: T, guard: Set<string>): ScheduledTask<T> => {
    const cached = result.get(task.id);
    if (cached) return cached;

    const children = groups.get(task.id) ?? [];

    if (children.length === 0) {
      const leaf = scheduledLeaves.get(task.id);
      if (!leaf) {
        throw new ScheduleError('INVALID_SCHEDULE', `Tugas "${task.id}" tidak dapat dijadwalkan.`);
      }
      result.set(task.id, leaf);
      return leaf;
    }

    if (guard.has(task.id)) {
      throw new ScheduleError('INVALID_SCHEDULE', 'Struktur tugas mengandung siklus induk.');
    }
    guard.add(task.id);

    const scheduledChildren = children.map((child) => resolveSummary(child, guard));
    guard.delete(task.id);

    let start = scheduledChildren[0].scheduledStart;
    let end = scheduledChildren[0].scheduledEnd;
    for (const child of scheduledChildren) {
      if (child.scheduledStart < start) start = child.scheduledStart;
      if (child.scheduledEnd > end) end = child.scheduledEnd;
    }

    const summary: ScheduledTask<T> = {
      ...task,
      scheduledStart: start,
      scheduledEnd: end,
      durationDays: workingDaysBetween(calendar, start, end),
      progress: weightedProgress(scheduledChildren),
    };

    result.set(task.id, summary);
    return summary;
  };

  return tasks.map((task) => resolveSummary(task, new Set<string>()));
}
