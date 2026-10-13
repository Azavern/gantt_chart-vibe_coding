import { Router } from 'express';
import { assignmentUpdateSchema, type AssignmentUpdateInput } from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { getOwnedAssignment } from '../services/access';
import { toAssignmentDto } from '../services/snapshot';

async function listAssignments(projectId: string) {
  const assignments = await prisma.assignment.findMany({ where: { task: { projectId } } });
  return assignments.map(toAssignmentDto);
}

export const assignmentRouter = Router();

assignmentRouter.patch(
  '/assignments/:id',
  requireAuth,
  validateBody(assignmentUpdateSchema),
  asyncHandler(async (req, res) => {
    const assignment = await getOwnedAssignment(currentUserId(req), req.params.id);
    const input = req.body as AssignmentUpdateInput;

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: assignment.taskId },
      select: { projectId: true },
    });

    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { allocationPercent: input.allocationPercent },
    });

    res.json({ assignments: await listAssignments(task.projectId) });
  }),
);

assignmentRouter.delete(
  '/assignments/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const assignment = await getOwnedAssignment(currentUserId(req), req.params.id);

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: assignment.taskId },
      select: { projectId: true },
    });

    await prisma.assignment.delete({ where: { id: assignment.id } });

    res.json({ assignments: await listAssignments(task.projectId) });
  }),
);
