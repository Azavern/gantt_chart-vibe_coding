import { Router } from 'express';

import { prisma } from '../db';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { getOwnedHoliday } from '../services/access';
import { recomputeProject } from '../services/recompute';
import { toHolidayDto } from '../services/snapshot';

export const holidayRouter = Router();

holidayRouter.delete(
  '/holidays/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const holiday = await getOwnedHoliday(userId, req.params.id);

    await prisma.holiday.delete({ where: { id: holiday.id } });

    const [holidays, tasks] = await Promise.all([
      prisma.holiday.findMany({ where: { projectId: holiday.projectId }, orderBy: { date: 'asc' } }),
      recomputeProject(holiday.projectId),
    ]);

    res.json({ holidays: holidays.map(toHolidayDto), tasks });
  }),
);
