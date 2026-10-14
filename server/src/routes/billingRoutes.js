import { Router } from 'express';

import { createBillingController } from '../controllers/billingController.js';
import { validateQuery } from '../middleware/validate.js';
import { createBillingRepository } from '../repositories/billingRepository.js';
import { createBillingService } from '../services/billingService.js';
import { billingQuerySchema } from '../validation/schemas.js';

export function createBillingRouter(database, authenticate) {
  const router = Router();

  const billingRepository = createBillingRepository(database);
  const billingService = createBillingService({ billingRepository });
  const billingController = createBillingController(billingService);

  router.use(authenticate);

  router.get('/overview', validateQuery(billingQuerySchema), billingController.overview);
  router.get('/upcoming', validateQuery(billingQuerySchema), billingController.upcoming);

  return {
    controller: billingController,
    repository: billingRepository,
    router,
    service: billingService,
  };
}
