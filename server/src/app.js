import cors from 'cors';
import express from 'express';

import config from './config/env.js';
import database from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { createApiRouter } from './routes/index.js';

export function createApp({ appConfig = config, databaseClient = database } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: appConfig.corsOrigin,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1', createApiRouter(databaseClient));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
