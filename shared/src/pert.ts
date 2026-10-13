import { computeCpm } from './cpm';
import type { ProjectCalendar } from './calendar';
import { topologicallySortedLeaves, type DependencyLink, type SchedulableTask, type ScheduledTask } from './scheduler';
import type { DependencyType } from './types';

/**
 * Diagram PERT (blueprint 6.9): activity-on-node berisi ES, EF, LS, LF, dan slack.
 * Estimasi tiga titik hanya menjadi informasi tambahan; jadwal tidak berubah.
 */

export interface PertTaskLike extends ScheduledTask<SchedulableTask> {
  name: string;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface PertNode {
  taskId: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  /** Slack = total float. */
  slack: number;
  critical: boolean;
  /** Kolom tata letak: kedalaman jalur terpanjang dari node awal. */
  column: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  /** Estimasi waktu yang diharapkan `(o + 4m + p) / 6`, null bila estimasi tidak lengkap. */
  te: number | null;
  /** Variansi `((p - o) / 6)^2`, null bila estimasi tidak lengkap. */
  variance: number | null;
}

export interface PertEdge {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
  critical: boolean;
}

export interface PertResult {
  nodes: PertNode[];
  edges: PertEdge[];
  criticalPath: string[];
  /** Jumlah `te` sepanjang jalur kritis, null bila tidak ada estimasi. */
  expectedDuration: number | null;
  /** Jumlah variansi sepanjang jalur kritis, null bila tidak ada estimasi. */
  totalVariance: number | null;
  /** Simpangan baku `sqrt(totalVariance)`, null bila tidak ada estimasi. */
  standardDeviation: number | null;
}

/** `te = (o + 4m + p) / 6`, hanya bila estimasi optimistis dan pesimistis terisi. */
export function expectedTime(
  durationDays: number,
  optimisticDays: number | null,
  pessimisticDays: number | null,
): number | null {
  if (optimisticDays === null || pessimisticDays === null) return null;
  return (optimisticDays + 4 * durationDays + pessimisticDays) / 6;
}

/** `variansi = ((p - o) / 6)^2`, hanya bila estimasi lengkap. */
export function timeVariance(
  optimisticDays: number | null,
  pessimisticDays: number | null,
): number | null {
  if (optimisticDays === null || pessimisticDays === null) return null;
  const deviation = (pessimisticDays - optimisticDays) / 6;
  return deviation * deviation;
}

export function buildPert(
  tasks: PertTaskLike[],
  dependencies: DependencyLink[],
  calendar: ProjectCalendar,
  projectStartDate: string,
): PertResult {
  const cpm = computeCpm(tasks, dependencies, calendar, projectStartDate);
  const leafIds = new Set(cpm.nodes.map((node) => node.taskId));

  const columns = new Map<string, number>();
  for (const leaf of topologicallySortedLeaves(tasks, dependencies)) {
    let column = 0;
    for (const link of dependencies) {
      if (link.successorId !== leaf.id) continue;
      if (!leafIds.has(link.predecessorId)) continue;
      const predecessorColumn = columns.get(link.predecessorId);
      if (predecessorColumn !== undefined && predecessorColumn + 1 > column) {
        column = predecessorColumn + 1;
      }
    }
    columns.set(leaf.id, column);
  }

  const nodes: PertNode[] = cpm.nodes.map((node) => {
    const task = tasks.find((candidate) => candidate.id === node.taskId) as PertTaskLike;

    return {
      taskId: node.taskId,
      name: task.name,
      durationDays: node.durationDays,
      es: node.es,
      ef: node.ef,
      ls: node.ls,
      lf: node.lf,
      slack: node.totalFloat,
      critical: node.critical,
      column: columns.get(node.taskId) ?? 0,
      optimisticDays: task.optimisticDays,
      pessimisticDays: task.pessimisticDays,
      te: expectedTime(node.durationDays, task.optimisticDays, task.pessimisticDays),
      variance: timeVariance(task.optimisticDays, task.pessimisticDays),
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.taskId, node]));

  const edges: PertEdge[] = [];
  for (const link of dependencies) {
    const predecessor = nodeById.get(link.predecessorId);
    const successor = nodeById.get(link.successorId);
    if (!predecessor || !successor) continue;

    const tight =
      link.type === 'FS'
        ? successor.es === predecessor.ef + 1 + link.lagDays
        : successor.es === predecessor.es + link.lagDays;

    edges.push({
      predecessorId: link.predecessorId,
      successorId: link.successorId,
      type: link.type,
      lagDays: link.lagDays,
      critical: tight && predecessor.critical && successor.critical,
    });
  }

  const pathNodes = cpm.criticalPath
    .map((taskId) => nodeById.get(taskId))
    .filter((node): node is PertNode => Boolean(node));

  const withEstimate = pathNodes.filter((node) => node.te !== null && node.variance !== null);
  const totalVariance =
    withEstimate.length > 0
      ? withEstimate.reduce((sum, node) => sum + (node.variance as number), 0)
      : null;

  return {
    nodes,
    edges,
    criticalPath: cpm.criticalPath,
    expectedDuration:
      withEstimate.length > 0
        ? withEstimate.reduce((sum, node) => sum + (node.te as number), 0)
        : null,
    totalVariance,
    standardDeviation: totalVariance === null ? null : Math.sqrt(totalVariance),
  };
}
