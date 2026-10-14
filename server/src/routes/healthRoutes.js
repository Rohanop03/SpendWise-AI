import { Router } from 'express';

import { createDatabaseHealthHandler, getHealth } from '../controllers/healthController.js';
import { createHealthService } from '../services/healthService.js';

export function createHealthRouter(database) {
  const router = Router();
  const healthService = createHealthService(database);

  router.get('/', getHealth);
  router.get('/database', createDatabaseHealthHandler(healthService));

  return router;
}
