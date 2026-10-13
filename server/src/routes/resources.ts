import { Router } from 'express';
import { resourceCreateSchema, resourceUpdateSchema, type ResourceCreateInput, type ResourceUpdateInput } from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { getOwnedProject, getOwnedResource } from '../services/access';
import { toAssignmentDto, toResourceDto } from '../services/snapshot';

export const resourceRouter = Router();

resourceRouter.get(
  '/projects/:id/resources',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const resources = await prisma.resource.findMany({
      where: { projectId: project.id },
      orderBy: { name: 'asc' },
    });

    res.json({ resources: resources.map(toResourceDto) });
  }),
);

resourceRouter.post(
  '/projects/:id/resources',
  requireAuth,
  validateBody(resourceCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const input = req.body as ResourceCreateInput;

    const resource = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: input.name,
        email: input.email,
        role: input.role,
        salary: input.salary,
      },
    });

    res.status(201).json({ resource: toResourceDto(resource) });
  }),
);

resourceRouter.patch(
  '/resources/:id',
  requireAuth,
  validateBody(resourceUpdateSchema),
  asyncHandler(async (req, res) => {
    const resource = await getOwnedResource(currentUserId(req), req.params.id);
    const input = req.body as ResourceUpdateInput;

    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.salary !== undefined ? { salary: input.salary } : {}),
      },
    });

    res.json({ resource: toResourceDto(updated) });
  }),
);

resourceRouter.delete(
  '/resources/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const resource = await getOwnedResource(currentUserId(req), req.params.id);

    // Alokasi anggota ikut terhapus lewat relasi cascade.
    await prisma.resource.delete({ where: { id: resource.id } });

    const [resources, assignments] = await Promise.all([
      prisma.resource.findMany({ where: { projectId: resource.projectId }, orderBy: { name: 'asc' } }),
      prisma.assignment.findMany({ where: { task: { projectId: resource.projectId } } }),
    ]);

    res.json({
      resources: resources.map(toResourceDto),
      assignments: assignments.map(toAssignmentDto),
    });
  }),
);
