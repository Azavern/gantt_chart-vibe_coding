import { Router } from 'express';
import {
  assignmentCreateSchema,
  dependencyCreateSchema,
  nextWorkingDay,
  shiftWorkingDays,
  taskCreateSchema,
  taskMoveSchema,
  taskUpdateSchema,
  wouldCreateCycle,
  type AssignmentCreateInput,
  type DependencyCreateInput,
  type TaskCreateInput,
  type TaskMoveInput,
  type TaskUpdateInput,
} from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { getOwnedProject, getOwnedTask } from '../services/access';
import { buildCalendar, recomputeProject } from '../services/recompute';
import { toAssignmentDto, toDependencyDto } from '../services/snapshot';
import {
  assertDepthAllowed,
  assertParentAcceptsChildren,
  getProjectTaskRows,
  insertTaskAt,
  isDescendantOf,
  nextSiblingPosition,
  renumberSiblings,
} from '../services/taskTree';

/** Bidang yang dihitung otomatis pada tugas induk (blueprint 6.5). */
const SUMMARY_COMPUTED_FIELDS = [
  'durationDays',
  'startDate',
  'progress',
  'optimisticDays',
  'pessimisticDays',
] as const;

export const taskRouter = Router();

taskRouter.post(
  '/projects/:id/tasks',
  requireAuth,
  validateBody(taskCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(userId, req.params.id);
    const input = req.body as TaskCreateInput;
    const calendar = buildCalendar(project.weekendDays, await prisma.holiday.findMany({ where: { projectId: project.id } }));

    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await prisma.task.findFirst({
        where: { id: input.parentId, projectId: project.id },
      });
      if (!parent) {
        throw new ApiError(422, 'INVALID_PARENT', 'Tugas induk tidak ditemukan pada proyek ini.');
      }

      const tasks = await getProjectTaskRows(project.id);
      assertDepthAllowed(parent.id, tasks);
      await assertParentAcceptsChildren(parent.id);
      parentId = parent.id;
    }

    const start = nextWorkingDay(calendar, input.startDate);
    const position = input.position ?? (await nextSiblingPosition(project.id, parentId));

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId,
        position,
        name: input.name,
        description: input.description ?? null,
        durationDays: input.durationDays,
        startDate: input.startDate,
        scheduledStart: start,
        scheduledEnd: shiftWorkingDays(calendar, start, input.durationDays - 1),
        priority: input.priority ?? 'MEDIUM',
        color: input.color ?? '#0D9488',
        progress: input.progress ?? 0,
        optimisticDays: input.optimisticDays ?? null,
        pessimisticDays: input.pessimisticDays ?? null,
      },
    });

    await insertTaskAt(project.id, created.id, parentId, input.position ?? null);

    const tasks = await recomputeProject(project.id);
    res.status(201).json({ tasks, taskId: created.id });
  }),
);

taskRouter.patch(
  '/tasks/:id',
  requireAuth,
  validateBody(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(userId, req.params.id);
    const input = req.body as TaskUpdateInput;

    const childCount = await prisma.task.count({ where: { parentId: task.id } });
    if (childCount > 0) {
      const blocked = SUMMARY_COMPUTED_FIELDS.filter((field) => field in input);
      if (blocked.length > 0) {
        throw new ApiError(
          422,
          'SUMMARY_TASK_READONLY',
          'Tugas induk hanya bisa diubah nama, deskripsi, warna, dan prioritasnya karena durasi serta progresnya dihitung otomatis.',
          { fields: blocked },
        );
      }
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.optimisticDays !== undefined ? { optimisticDays: input.optimisticDays ?? null } : {}),
        ...(input.pessimisticDays !== undefined ? { pessimisticDays: input.pessimisticDays ?? null } : {}),
      },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ tasks });
  }),
);

taskRouter.delete(
  '/tasks/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(userId, req.params.id);

    // Anak, dependensi, dan alokasi ikut terhapus lewat relasi cascade.
    await prisma.task.delete({ where: { id: task.id } });
    await renumberSiblings(project.id, task.parentId);

    const tasks = await recomputeProject(project.id);
    res.json({ tasks });
  }),
);

taskRouter.post(
  '/tasks/:id/move',
  requireAuth,
  validateBody(taskMoveSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(userId, req.params.id);
    const { parentId, position } = req.body as TaskMoveInput;

    if (parentId === task.id) {
      throw new ApiError(422, 'INVALID_PARENT', 'Tugas tidak bisa menjadi induk bagi dirinya sendiri.');
    }

    const tasks = await getProjectTaskRows(project.id);

    if (parentId) {
      const parent = tasks.find((candidate) => candidate.id === parentId);
      if (!parent) {
        throw new ApiError(422, 'INVALID_PARENT', 'Tugas induk tidak ditemukan pada proyek ini.');
      }
      if (isDescendantOf(tasks, parentId, task.id)) {
        throw new ApiError(
          422,
          'INVALID_PARENT',
          'Tugas tidak bisa dipindahkan ke bawah turunannya sendiri.',
        );
      }

      assertDepthAllowed(parentId, tasks, task.id);
      await assertParentAcceptsChildren(parentId);
    }

    const previousParentId = task.parentId;
    await insertTaskAt(project.id, task.id, parentId, position);
    if (previousParentId !== parentId) {
      await renumberSiblings(project.id, previousParentId);
    }

    const updated = await recomputeProject(project.id);
    res.json({ tasks: updated });
  }),
);

taskRouter.post(
  '/tasks/:id/dependencies',
  requireAuth,
  validateBody(dependencyCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(userId, req.params.id);
    const input = req.body as DependencyCreateInput;

    const predecessor = await prisma.task.findFirst({
      where: { id: input.predecessorId, projectId: project.id },
    });
    if (!predecessor) {
      throw new ApiError(
        422,
        'INVALID_PREDECESSOR',
        'Predecessor tidak ditemukan pada proyek ini.',
      );
    }
    if (predecessor.id === task.id) {
      throw new ApiError(422, 'SELF_DEPENDENCY', 'Tugas tidak bisa menjadi predecessor dirinya sendiri.');
    }

    const childCount = await prisma.task.count({
      where: { OR: [{ parentId: task.id }, { parentId: predecessor.id }] },
    });
    if (childCount > 0) {
      throw new ApiError(
        422,
        'LEAF_ONLY',
        'Hanya tugas daun yang boleh punya dependensi. Tugas induk menghitung jadwalnya dari anak.',
      );
    }

    const duplicate = await prisma.dependency.findFirst({
      where: { predecessorId: predecessor.id, successorId: task.id },
    });
    if (duplicate) {
      throw new ApiError(422, 'DUPLICATE_DEPENDENCY', 'Dependensi antara kedua tugas ini sudah ada.');
    }

    const existing = await prisma.dependency.findMany({ where: { projectId: project.id } });
    const links = existing.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type === 'SS' ? ('SS' as const) : ('FS' as const),
      lagDays: dependency.lagDays,
    }));

    if (wouldCreateCycle(links, { from: predecessor.id, to: task.id })) {
      throw new ApiError(
        422,
        'CYCLE_DETECTED',
        'Dependensi ini membentuk siklus. Periksa kembali rangkaian predecessornya.',
      );
    }

    await prisma.dependency.create({
      data: {
        projectId: project.id,
        predecessorId: predecessor.id,
        successorId: task.id,
        type: input.type,
        lagDays: input.lagDays ?? 0,
      },
    });

    const tasks = await recomputeProject(project.id);
    const dependencies = await prisma.dependency.findMany({ where: { projectId: project.id } });

    res.status(201).json({ tasks, dependencies: dependencies.map(toDependencyDto) });
  }),
);

taskRouter.post(
  '/tasks/:id/assignments',
  requireAuth,
  validateBody(assignmentCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const { task, project } = await getOwnedTask(userId, req.params.id);
    const input = req.body as AssignmentCreateInput;

    const childCount = await prisma.task.count({ where: { parentId: task.id } });
    if (childCount > 0) {
      throw new ApiError(
        422,
        'LEAF_ONLY',
        'Hanya tugas daun yang boleh punya alokasi anggota tim.',
      );
    }

    const resource = await prisma.resource.findFirst({
      where: { id: input.resourceId, projectId: project.id },
    });
    if (!resource) {
      throw new ApiError(422, 'INVALID_RESOURCE', 'Anggota tim tidak ditemukan pada proyek ini.');
    }

    const duplicate = await prisma.assignment.findFirst({
      where: { taskId: task.id, resourceId: resource.id },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        'CONFLICT',
        `${resource.name} sudah dialokasikan pada tugas ini. Ubah persentase alokasinya bila perlu.`,
      );
    }

    await prisma.assignment.create({
      data: {
        taskId: task.id,
        resourceId: resource.id,
        allocationPercent: input.allocationPercent ?? 100,
      },
    });

    const assignments = await prisma.assignment.findMany({ where: { task: { projectId: project.id } } });
    res.status(201).json({ assignments: assignments.map(toAssignmentDto) });
  }),
);
