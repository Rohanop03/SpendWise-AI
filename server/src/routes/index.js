import { Router } from 'express';

import { createAccountRouter } from './accountRoutes.js';
import { createAuthRouter } from './authRoutes.js';
import { createHealthRouter } from './healthRoutes.js';

export function createApiRouter(database, appConfig) {
  const router = Router();
  const auth = createAuthRouter(database, appConfig);

  router.use('/health', createHealthRouter(database));
  router.use('/auth', auth.router);
  router.use('/users', createAccountRouter(database, auth.authenticate));

  return router;
}
