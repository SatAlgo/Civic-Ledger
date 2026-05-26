import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { env, corsOrigins } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import issueRoutes from './routes/issues';
import deptRoutes from './routes/dept';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';

export function createApp(): Express {
  const app = express();

  // Trust proxy headers (needed when deployed behind Render/Heroku/Nginx)
  app.set('trust proxy', 1);

  // Security & basics
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Liveness
  app.get('/health', (_req, res) => {
    res.json({ ok: true, env: env.NODE_ENV, ts: new Date().toISOString() });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/dept', deptRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  // 404 + error handler — must be last
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
