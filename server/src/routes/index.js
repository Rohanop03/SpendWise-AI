import { Router } from 'express';

import { createHealthRouter } from './healthRoutes.js';

export function createApiRouter(database) {
  const router = Router();

  router.use('/health', createHealthRouter(database));

  return router;
}
