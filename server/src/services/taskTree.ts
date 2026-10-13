import type { Task as TaskRow } from '@prisma/client';
import { MAX_TASK_DEPTH, computeTaskDepth } from '@gantt/shared';

import { prisma } from '../db';
import { ApiError } from '../middleware/error';

/**
 * Aturan struktur tugas (blueprint 6.5): kedalaman maksimal 3 level, tugas yang
 * punya dependensi atau alokasi tidak boleh diberi anak, dan urutan saudara
 * disimpan pada kolom `position`.
 */

export async function getProjectTaskRows(projectId: string): Promise<TaskRow[]> {
  return prisma.task.findMany({ where: { projectId } });
}

/** Tinggi subtree dalam level; 1 bila tugas tidak punya anak. */
export function subtreeHeight(tasks: TaskRow[], taskId: string): number {
  const children = tasks.filter((task) => task.parentId === taskId);
  if (children.length === 0) return 1;

  return 1 + Math.max(...children.map((child) => subtreeHeight(tasks, child.id)));
}

export function isDescendantOf(tasks: TaskRow[], candidateId: string, ancestorId: string): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let current = byId.get(candidateId);

  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }

  return false;
}

/** Menolak (409) bila tugas calon induk sudah punya dependensi atau alokasi. */
export async function assertParentAcceptsChildren(parentId: string): Promise<void> {
  const [dependencyCount, assignmentCount] = await Promise.all([
    prisma.dependency.count({
      where: { OR: [{ predecessorId: parentId }, { successorId: parentId }] },
    }),
    prisma.assignment.count({ where: { taskId: parentId } }),
  ]);

  if (dependencyCount > 0 || assignmentCount > 0) {
    throw new ApiError(
      409,
      'TASK_HAS_RELATIONS',
      'Tugas ini sudah punya dependensi atau alokasi anggota, jadi tidak bisa dijadikan tugas induk.',
    );
  }
}

export function assertDepthAllowed(parentTaskId: string | null, tasks: TaskRow[], movingTaskId?: string): void {
  if (!parentTaskId) return;

  const depths = computeTaskDepth(tasks);

  if (movingTaskId) {
    const parentDepth = depths.get(parentTaskId) ?? 1;
    const height = subtreeHeight(tasks, movingTaskId);
    if (parentDepth + height > MAX_TASK_DEPTH) {
      throw new ApiError(
        422,
        'MAX_DEPTH_EXCEEDED',
        `Kedalaman tugas maksimal ${MAX_TASK_DEPTH} level.`,
      );
    }
    return;
  }

  const parentDepth = depths.get(parentTaskId) ?? 1;
  if (parentDepth + 1 > MAX_TASK_DEPTH) {
    throw new ApiError(
      422,
      'MAX_DEPTH_EXCEEDED',
      `Kedalaman tugas maksimal ${MAX_TASK_DEPTH} level.`,
    );
  }
}

/** Menempatkan tugas pada posisi tertentu di antara saudaranya dan merapikan urutan. */
export async function insertTaskAt(
  projectId: string,
  taskId: string,
  parentId: string | null,
  index: number | null,
): Promise<void> {
  await prisma.task.update({ where: { id: taskId }, data: { parentId } });

  const siblings = await prisma.task.findMany({
    where: { projectId, parentId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });

  const others = siblings.filter((sibling) => sibling.id !== taskId);
  const insertAt = index === null ? others.length : Math.min(Math.max(index, 0), others.length);
  const orderedIds = [
    ...others.slice(0, insertAt).map((sibling) => sibling.id),
    taskId,
    ...others.slice(insertAt).map((sibling) => sibling.id),
  ];

  const updates = orderedIds
    .map((id, position) => ({ id, position }))
    .filter(({ id, position }) => siblings.find((sibling) => sibling.id === id)?.position !== position);

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(({ id, position }) =>
        prisma.task.update({ where: { id }, data: { position } }),
      ),
    );
  }
}

/** Merapikan ulang nomor posisi satu kelompok saudara menjadi 0..n-1. */
export async function renumberSiblings(projectId: string, parentId: string | null): Promise<void> {
  const siblings = await prisma.task.findMany({
    where: { projectId, parentId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });

  const updates = siblings
    .map((sibling, position) => ({ id: sibling.id, position, current: sibling.position }))
    .filter(({ position, current }) => position !== current);

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(({ id, position }) => prisma.task.update({ where: { id }, data: { position } })),
    );
  }
}

export async function nextSiblingPosition(projectId: string, parentId: string | null): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId, parentId },
    orderBy: { position: 'desc' },
  });

  return last ? last.position + 1 : 0;
}
