import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';

import config from './config/env.js';
import database from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { createApiRouter } from './routes/index.js';

export function createApp({ appConfig = config, databaseClient = database } = {}) {
  if (!appConfig.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET is required to start authentication routes.');
  }

  if (appConfig.nodeEnv === 'production' && !appConfig.cookieSecure) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      credentials: true,
      origin: appConfig.corsOrigin,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/v1', createApiRouter(databaseClient, appConfig));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
