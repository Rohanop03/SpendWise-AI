import { Router } from 'express';

import { createSubscriptionController } from '../controllers/subscriptionController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createSubscriptionRepository } from '../repositories/subscriptionRepository.js';
import { createSubscriptionService } from '../services/subscriptionService.js';
import {
  createSubscriptionSchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from '../validation/schemas.js';

export function createSubscriptionRouter(database, authenticate) {
  const router = Router();
  const repository = createSubscriptionRepository(database);
  const service = createSubscriptionService(repository);
  const controller = createSubscriptionController(service);

  router.use(authenticate);

  router.post('/', validateBody(createSubscriptionSchema), controller.create);
  router.get('/', validateQuery(subscriptionQuerySchema), controller.list);
  router.get('/:id', controller.getById);
  router.patch('/:id', validateBody(updateSubscriptionSchema), controller.update);
  router.post('/:id/archive', controller.archive);
  router.post('/:id/restore', controller.restore);

  return router;
}
