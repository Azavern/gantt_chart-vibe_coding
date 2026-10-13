import type {
  Assignment as AssignmentRow,
  Dependency as DependencyRow,
  Holiday as HolidayRow,
  Project as ProjectRow,
  Resource as ResourceRow,
  Task as TaskRow,
} from '@prisma/client';

import { prisma } from '../db';
import { ApiError } from '../middleware/error';

/**
 * Setiap data dicek kepemilikannya (blueprint bagian 7): hanya pemilik proyek
 * yang boleh mengakses, selain itu 404 supaya keberadaan data tidak terbocorkan.
 */

function notFound(entity: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', `${entity} tidak ditemukan.`);
}

export async function getOwnedProject(userId: string, projectId: string): Promise<ProjectRow> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw notFound('Proyek');
  return project;
}

export async function getOwnedTask(
  userId: string,
  taskId: string,
): Promise<{ task: TaskRow; project: ProjectRow }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { ownerId: userId } },
    include: { project: true },
  });
  if (!task) throw notFound('Tugas');

  const { project, ...rest } = task;
  return { task: rest, project };
}

export async function getOwnedDependency(
  userId: string,
  dependencyId: string,
): Promise<DependencyRow> {
  const dependency = await prisma.dependency.findFirst({
    where: { id: dependencyId, project: { ownerId: userId } },
  });
  if (!dependency) throw notFound('Dependensi');
  return dependency;
}

export async function getOwnedResource(userId: string, resourceId: string): Promise<ResourceRow> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, project: { ownerId: userId } },
  });
  if (!resource) throw notFound('Anggota tim');
  return resource;
}

export async function getOwnedAssignment(
  userId: string,
  assignmentId: string,
): Promise<AssignmentRow> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, task: { project: { ownerId: userId } } },
  });
  if (!assignment) throw notFound('Alokasi');
  return assignment;
}

export async function getOwnedHoliday(userId: string, holidayId: string): Promise<HolidayRow> {
  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, project: { ownerId: userId } },
  });
  if (!holiday) throw notFound('Hari libur');
  return holiday;
}
