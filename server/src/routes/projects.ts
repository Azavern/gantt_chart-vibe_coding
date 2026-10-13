import { Router } from 'express';
import {
  calendarUpdateSchema,
  holidayCreateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  serializeWeekendDays,
  type CalendarUpdateInput,
  type HolidayCreateInput,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { getOwnedProject } from '../services/access';
import { recomputeProject } from '../services/recompute';
import { getProjectSnapshot, toHolidayDto, toProjectDto } from '../services/snapshot';

export const projectRouter = Router();

projectRouter.get(
  '/projects',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tasks: true, resources: true } } },
    });

    const items = await Promise.all(
      projects.map(async (project) => ({
        ...toProjectDto(project),
        taskCount: project._count.tasks,
        resourceCount: project._count.resources,
      })),
    );

    res.json({ projects: items });
  }),
);

projectRouter.post(
  '/projects',
  requireAuth,
  validateBody(projectCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const input = req.body as ProjectCreateInput;

    const project = await prisma.project.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate,
        weekendDays: serializeWeekendDays(input.weekendDays ?? [0, 6]),
      },
    });

    res.status(201).json({ project: toProjectDto(project) });
  }),
);

projectRouter.get(
  '/projects/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    res.json(await getProjectSnapshot(project));
  }),
);

projectRouter.patch(
  '/projects/:id',
  requireAuth,
  validateBody(projectUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(userId, req.params.id);
    const input = req.body as ProjectUpdateInput;

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.weekendDays !== undefined
          ? { weekendDays: serializeWeekendDays(input.weekendDays) }
          : {}),
      },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ project: toProjectDto(updated), tasks });
  }),
);

projectRouter.delete(
  '/projects/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    await prisma.project.delete({ where: { id: project.id } });
    res.status(204).send();
  }),
);

projectRouter.put(
  '/projects/:id/calendar',
  requireAuth,
  validateBody(calendarUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(userId, req.params.id);
    const input = req.body as CalendarUpdateInput;

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { weekendDays: serializeWeekendDays(input.weekendDays) },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ project: toProjectDto(updated), tasks });
  }),
);

projectRouter.post(
  '/projects/:id/holidays',
  requireAuth,
  validateBody(holidayCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(userId, req.params.id);
    const input = req.body as HolidayCreateInput;

    const existing = await prisma.holiday.findFirst({
      where: { projectId: project.id, date: input.date },
    });
    if (existing) {
      throw new ApiError(
        409,
        'CONFLICT',
        `Tanggal ${input.date} sudah terdaftar sebagai hari libur "${existing.name}".`,
      );
    }

    await prisma.holiday.create({
      data: { projectId: project.id, date: input.date, name: input.name },
    });

    const [holidays, tasks] = await Promise.all([
      prisma.holiday.findMany({ where: { projectId: project.id }, orderBy: { date: 'asc' } }),
      recomputeProject(project.id),
    ]);

    res.status(201).json({ holidays: holidays.map(toHolidayDto), tasks });
  }),
);
