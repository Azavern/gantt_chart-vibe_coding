import { Router } from 'express';
import { dependencyUpdateSchema, type DependencyUpdateInput } from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { getOwnedDependency } from '../services/access';
import { recomputeProject } from '../services/recompute';
import { toDependencyDto } from '../services/snapshot';

export const dependencyRouter = Router();

dependencyRouter.patch(
  '/dependencies/:id',
  requireAuth,
  validateBody(dependencyUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const dependency = await getOwnedDependency(userId, req.params.id);
    const input = req.body as DependencyUpdateInput;

    await prisma.dependency.update({
      where: { id: dependency.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.lagDays !== undefined ? { lagDays: input.lagDays } : {}),
      },
    });

    const [tasks, dependencies] = await Promise.all([
      recomputeProject(dependency.projectId),
      prisma.dependency.findMany({ where: { projectId: dependency.projectId } }),
    ]);

    res.json({ tasks, dependencies: dependencies.map(toDependencyDto) });
  }),
);

dependencyRouter.delete(
  '/dependencies/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const dependency = await getOwnedDependency(userId, req.params.id);

    await prisma.dependency.delete({ where: { id: dependency.id } });

    const [tasks, dependencies] = await Promise.all([
      recomputeProject(dependency.projectId),
      prisma.dependency.findMany({ where: { projectId: dependency.projectId } }),
    ]);

    res.json({ tasks, dependencies: dependencies.map(toDependencyDto) });
  }),
);
