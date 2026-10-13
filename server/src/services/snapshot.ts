import type {
  Assignment as AssignmentRow,
  Dependency as DependencyRow,
  Holiday as HolidayRow,
  Project as ProjectRow,
  Resource as ResourceRow,
  Task as TaskRow,
  User as UserRow,
} from '@prisma/client';
import {
  flattenTaskTree,
  parseWeekendDays,
  type AssignmentDto,
  type DependencyDto,
  type DependencyType,
  type HolidayDto,
  type Priority,
  type ProjectDto,
  type ProjectSnapshot,
  type ResourceDto,
  type TaskDto,
  type UserDto,
} from '@gantt/shared';

import { prisma } from '../db';

/**
 * Mengubah baris database menjadi DTO yang dipakai bersama server dan client
 * (blueprint bagian 7). `passwordHash` tidak pernah ikut dikirim.
 */

function toPriority(value: string): Priority {
  return value === 'HIGH' || value === 'LOW' ? value : 'MEDIUM';
}

function toDependencyType(value: string): DependencyType {
  return value === 'SS' ? 'SS' : 'FS';
}

export function toUserDto(user: UserRow): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toProjectDto(project: ProjectRow): ProjectDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    weekendDays: parseWeekendDays(project.weekendDays),
    createdAt: project.createdAt.toISOString(),
  };
}

export function toHolidayDto(holiday: HolidayRow): HolidayDto {
  return {
    id: holiday.id,
    projectId: holiday.projectId,
    date: holiday.date,
    name: holiday.name,
  };
}

export function toTaskDto(task: TaskRow): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: task.description,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: toPriority(task.priority),
    color: task.color,
    progress: task.progress,
    optimisticDays: task.optimisticDays,
    pessimisticDays: task.pessimisticDays,
  };
}

export function toDependencyDto(dependency: DependencyRow): DependencyDto {
  return {
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: toDependencyType(dependency.type),
    lagDays: dependency.lagDays,
  };
}

export function toResourceDto(resource: ResourceRow): ResourceDto {
  return {
    id: resource.id,
    projectId: resource.projectId,
    name: resource.name,
    email: resource.email,
    role: resource.role,
    salary: resource.salary,
  };
}

export function toAssignmentDto(assignment: AssignmentRow): AssignmentDto {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  };
}

export interface ProjectRelations {
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
}

/** Seluruh data proyek yang dibutuhkan client, diurutkan siap tampil. */
export async function getProjectRelations(projectId: string): Promise<ProjectRelations> {
  const [tasks, dependencies, resources, assignments, holidays] = await Promise.all([
    prisma.task.findMany({ where: { projectId } }),
    prisma.dependency.findMany({ where: { projectId } }),
    prisma.resource.findMany({ where: { projectId }, orderBy: { name: 'asc' } }),
    prisma.assignment.findMany({ where: { task: { projectId } } }),
    prisma.holiday.findMany({ where: { projectId }, orderBy: { date: 'asc' } }),
  ]);

  return {
    tasks: flattenTaskTree(tasks.map(toTaskDto)),
    dependencies: dependencies.map(toDependencyDto),
    resources: resources.map(toResourceDto),
    assignments: assignments.map(toAssignmentDto),
    holidays: holidays.map(toHolidayDto),
  };
}

/** Daftar tugas proyek dalam urutan WBS (dipakai respons mutasi jadwal). */
export async function getProjectTasks(projectId: string): Promise<TaskDto[]> {
  const tasks = await prisma.task.findMany({ where: { projectId } });
  return flattenTaskTree(tasks.map(toTaskDto));
}

export async function getProjectSnapshot(project: ProjectRow): Promise<ProjectSnapshot> {
  const relations = await getProjectRelations(project.id);

  return {
    project: toProjectDto(project),
    ...relations,
  };
}
