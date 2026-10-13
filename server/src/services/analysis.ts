import type { Project as ProjectRow } from '@prisma/client';
import {
  buildPert,
  computeCpm,
  costByResource,
  findOverAllocations,
  getLeafTasks,
  projectCost,
  workingDaysBetween,
  type AnalysisCpmRow,
  type AnalysisResourceRow,
  type AnalysisResult,
} from '@gantt/shared';

import { buildCalendar } from './recompute';
import { getProjectRelations } from './snapshot';

/**
 * Analisis proyek (blueprint 6.8 - 6.10 dan 8.4): CPM, jalur kritis, data PERT,
 * biaya, dan beban kerja anggota tim.
 */
export async function buildAnalysis(project: ProjectRow): Promise<AnalysisResult> {
  const relations = await getProjectRelations(project.id);
  const calendar = buildCalendar(project.weekendDays, relations.holidays);

  const { tasks, dependencies, resources, assignments } = relations;

  const cpm = computeCpm(tasks, dependencies, calendar, project.startDate);
  const pert = buildPert(tasks, dependencies, calendar, project.startDate);
  const leaves = getLeafTasks(tasks);
  const nameById = new Map(tasks.map((task) => [task.id, task.name]));

  const totalCost = projectCost(tasks, assignments, resources);
  const byResource = costByResource(tasks, assignments, resources);
  const overAllocations = findOverAllocations(tasks, assignments, resources, calendar);
  const overAllocatedResourceIds = new Set(overAllocations.map((warning) => warning.resourceId));

  const cpmRows: AnalysisCpmRow[] = cpm.nodes.map((node) => ({
    taskId: node.taskId,
    name: nameById.get(node.taskId) ?? node.taskId,
    durationDays: node.durationDays,
    es: node.es,
    ef: node.ef,
    ls: node.ls,
    lf: node.lf,
    totalFloat: node.totalFloat,
    critical: node.critical,
  }));

  const resourceRows: AnalysisResourceRow[] = resources.map((resource) => ({
    resourceId: resource.id,
    name: resource.name,
    role: resource.role,
    salary: resource.salary,
    totalCost: byResource.find((row) => row.resourceId === resource.id)?.totalCost ?? 0,
    taskCount: assignments.filter((assignment) => assignment.resourceId === resource.id).length,
    overAllocated: overAllocatedResourceIds.has(resource.id),
  }));

  const startDate = leaves.length > 0 ? leaves.reduce((min, leaf) => (leaf.scheduledStart < min ? leaf.scheduledStart : min), leaves[0].scheduledStart) : null;
  const endDate = leaves.length > 0 ? leaves.reduce((max, leaf) => (leaf.scheduledEnd > max ? leaf.scheduledEnd : max), leaves[0].scheduledEnd) : null;

  return {
    summary: {
      startDate,
      endDate,
      totalWorkingDays: startDate && endDate ? workingDaysBetween(calendar, startDate, endDate) : 0,
      totalCost,
      criticalTaskCount: cpm.criticalTaskIds.length,
      leafTaskCount: leaves.length,
    },
    cpm: cpmRows,
    criticalPath: cpm.criticalPath,
    pert,
    cost: { total: totalCost, byResource },
    resources: resourceRows,
    overAllocations,
  };
}
