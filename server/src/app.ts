import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler } from './middleware/error';
import { analysisRouter } from './routes/analysis';
import { assignmentRouter } from './routes/assignments';
import { authRouter } from './routes/auth';
import { dependencyRouter } from './routes/dependencies';
import { holidayRouter } from './routes/holidays';
import { projectRouter } from './routes/projects';
import { resourceRouter } from './routes/resources';
import { taskRouter } from './routes/tasks';

/**
 * Aplikasi Express lengkap (blueprint bagian 7). `createApp` dipakai server
 * maupun pengujian Supertest, sehingga keduanya menguji konfigurasi yang sama.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', projectRouter);
  app.use('/api', taskRouter);
  app.use('/api', dependencyRouter);
  app.use('/api', resourceRouter);
  app.use('/api', assignmentRouter);
  app.use('/api', holidayRouter);
  app.use('/api', analysisRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
