import { workingDaysBetween, type ProjectCalendar } from './calendar';
import { compareISODate } from './dates';
import {
  getLeafTasks,
  topologicallySortedLeaves,
  type DependencyLink,
  type SchedulableTask,
  type ScheduledTask,
} from './scheduler';

/**
 * Critical Path Method (blueprint 6.8). Hanya tugas daun yang dihitung.
 * Semua nilai memakai ordinal hari kerja: `ord(d)` = jumlah hari kerja dari
 * awal proyek (ordinal 0) sampai tanggal `d`.
 */

export type CpmTaskLike = ScheduledTask<SchedulableTask>;

export interface CpmNode {
  taskId: string;
  durationDays: number;
  /** Early Start (ordinal hari kerja). */
  es: number;
  /** Early Finish (ordinal hari kerja). */
  ef: number;
  /** Late Start (ordinal hari kerja). */
  ls: number;
  /** Late Finish (ordinal hari kerja). */
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface CpmResult {
  nodes: CpmNode[];
  byTaskId: Map<string, CpmNode>;
  /** Ordinal hari kerja dari selesainya seluruh proyek. */
  projectEnd: number;
  /** Rangkaian tugas kritis yang terhubung, diurutkan menurut ES. */
  criticalPath: string[];
  criticalTaskIds: string[];
}

/** Ordinal hari kerja `date` terhadap `projectStart` (ordinal 0). */
export function workdayOrdinal(calendar: ProjectCalendar, projectStart: string, date: string): number {
  const comparison = compareISODate(date, projectStart);
  if (comparison === 0) return 0;
  if (comparison > 0) return workingDaysBetween(calendar, projectStart, date) - 1;
  // Tanggal sebelum awal proyek (tidak lazim) menghasilkan ordinal negatif.
  return -workingDaysBetween(calendar, date, projectStart);
}

function buildCriticalPath(
  criticalIds: Set<string>,
  adjacency: Map<string, string[]>,
  nodes: Map<string, CpmNode>,
): string[] {
  if (criticalIds.size === 0) return [];

  const chainLength = new Map<string, number>();

  const measure = (id: string): number => {
    const cached = chainLength.get(id);
    if (cached !== undefined) return cached;

    let best = 1;
    for (const next of adjacency.get(id) ?? []) {
      if (!criticalIds.has(next)) continue;
      const candidate = 1 + measure(next);
      if (candidate > best) best = candidate;
    }

    chainLength.set(id, best);
    return best;
  };

  let startId: string | null = null;
  for (const id of criticalIds) {
    const length = measure(id);
    if (startId === null) {
      startId = id;
      continue;
    }

    const currentBest = chainLength.get(startId) ?? 1;
    const currentNode = nodes.get(startId);
    const candidateNode = nodes.get(id);

    if (length > currentBest) {
      startId = id;
    } else if (length === currentBest && currentNode && candidateNode && candidateNode.es < currentNode.es) {
      startId = id;
    }
  }

  const path: string[] = [];
  let current: string | undefined = startId ?? undefined;

  while (current) {
    path.push(current);
    let next: string | undefined;

    for (const candidate of adjacency.get(current) ?? []) {
      if (!criticalIds.has(candidate)) continue;
      const candidateLength = chainLength.get(candidate) ?? 1;
      if (next === undefined || candidateLength > (chainLength.get(next) ?? 1)) {
        next = candidate;
      }
    }

    current = next;
  }

  return path;
}

export function computeCpm(
  tasks: CpmTaskLike[],
  dependencies: DependencyLink[],
  calendar: ProjectCalendar,
  projectStartDate: string,
): CpmResult {
  const leaves = getLeafTasks(tasks);
  const leafIds = new Set(leaves.map((leaf) => leaf.id));

  if (leaves.length === 0) {
    return {
      nodes: [],
      byTaskId: new Map(),
      projectEnd: 0,
      criticalPath: [],
      criticalTaskIds: [],
    };
  }

  const order = topologicallySortedLeaves(tasks, dependencies);
  const nodes = new Map<string, CpmNode>();

  for (const leaf of order) {
    const es = workdayOrdinal(calendar, projectStartDate, leaf.scheduledStart);
    const ef = workdayOrdinal(calendar, projectStartDate, leaf.scheduledEnd);
    nodes.set(leaf.id, {
      taskId: leaf.id,
      durationDays: ef - es + 1,
      es,
      ef,
      ls: 0,
      lf: 0,
      totalFloat: 0,
      critical: false,
    });
  }

  const successors = new Map<string, DependencyLink[]>();
  for (const link of dependencies) {
    if (!leafIds.has(link.predecessorId) || !leafIds.has(link.successorId)) continue;

    const list = successors.get(link.predecessorId);
    if (list) list.push(link);
    else successors.set(link.predecessorId, [link]);
  }

  let projectEnd = 0;
  for (const node of nodes.values()) {
    if (node.ef > projectEnd) projectEnd = node.ef;
  }

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const node = nodes.get(order[index].id);
    if (!node) continue;

    const outgoing = successors.get(node.taskId) ?? [];
    if (outgoing.length === 0) {
      node.lf = projectEnd;
    } else {
      let lateFinish = Number.POSITIVE_INFINITY;

      for (const link of outgoing) {
        const successor = nodes.get(link.successorId);
        if (!successor) continue;

        const successorLateStart = successor.lf - successor.durationDays + 1;
        const candidate =
          link.type === 'FS'
            ? successorLateStart - 1 - link.lagDays
            : successorLateStart - link.lagDays + node.durationDays - 1;

        if (candidate < lateFinish) lateFinish = candidate;
      }

      node.lf = Number.isFinite(lateFinish) ? lateFinish : projectEnd;
    }

    node.ls = node.lf - node.durationDays + 1;
    node.totalFloat = Math.max(0, node.ls - node.es);
    node.critical = node.totalFloat === 0;
  }

  const criticalIds = new Set(
    Array.from(nodes.values())
      .filter((node) => node.critical)
      .map((node) => node.taskId),
  );

  const adjacency = new Map<string, string[]>();
  for (const link of dependencies) {
    if (!leafIds.has(link.predecessorId) || !leafIds.has(link.successorId)) continue;
    const list = adjacency.get(link.predecessorId);
    if (list) list.push(link.successorId);
    else adjacency.set(link.predecessorId, [link.successorId]);
  }

  const criticalPath = buildCriticalPath(criticalIds, adjacency, nodes);

  return {
    nodes: leaves.map((leaf) => nodes.get(leaf.id) as CpmNode),
    byTaskId: nodes,
    projectEnd,
    criticalPath,
    criticalTaskIds: Array.from(criticalIds),
  };
}
