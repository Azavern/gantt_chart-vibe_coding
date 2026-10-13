import { Router } from 'express';

import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { getOwnedProject } from '../services/access';
import { buildAnalysis } from '../services/analysis';

export const analysisRouter = Router();

analysisRouter.get(
  '/projects/:id/analysis',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    res.json(await buildAnalysis(project));
  }),
);
