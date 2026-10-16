import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';

import config from './config/env.js';
import database from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { createApiRouter } from './routes/index.js';

export function createApp({ appConfig = config, databaseClient = database } = {}) {
  if (!appConfig.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET is required to start authentication routes.');
  }

  if (appConfig.nodeEnv === 'production' && !appConfig.cookieSecure) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }

  const app = express();

  if (appConfig.trustProxy !== undefined && appConfig.trustProxy !== false) {
    app.set('trust proxy', appConfig.trustProxy);
  }

  app.disable('x-powered-by');
  app.use(securityHeaders(appConfig));
  app.use(
    cors({
      credentials: true,
      origin: appConfig.corsOrigin,
    }),
  );
  // gzip: JSON lists shrink 5-10x on the wire.
  app.use(compression({ threshold: 1024 }));
  app.use(express.json({ limit: '100kb' }));
  // Express adds a weak ETag to every JSON response; "private, no-cache" lets the browser keep
  // a per-user copy and revalidate it, so unchanged GETs come back as an empty 304.
  app.use('/api/v1', (request, response, next) => {
    if (request.method === 'GET') {
      response.set('Cache-Control', 'private, no-cache');
      response.vary('Authorization');
    }
    next();
  });
  app.use(cookieParser());

  app.use('/api/v1', createApiRouter(databaseClient, appConfig));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
