import { Router } from 'express';

import { createPaymentController } from '../controllers/paymentController.js';
import { createSubscriptionController } from '../controllers/subscriptionController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createPaymentRepository } from '../repositories/paymentRepository.js';
import { createRefundRepository } from '../repositories/refundRepository.js';
import { createSubscriptionRepository } from '../repositories/subscriptionRepository.js';
import { createPaymentService } from '../services/paymentService.js';
import { createSubscriptionService } from '../services/subscriptionService.js';
import {
  createPaymentSchema,
  createSubscriptionSchema,
  paymentQuerySchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from '../validation/schemas.js';

export function createSubscriptionRouter(database, authenticate) {
  const router = Router();
  const repository = createSubscriptionRepository(database);
  const service = createSubscriptionService(repository);
  const controller = createSubscriptionController(service);

  const paymentRepository = createPaymentRepository(database);
  const refundRepository = createRefundRepository(database);
  const paymentService = createPaymentService({
    database,
    paymentRepository,
    refundRepository,
    subscriptionRepository: repository,
  });
  const paymentController = createPaymentController(paymentService);

  router.use(authenticate);

  router.post('/', validateBody(createSubscriptionSchema), controller.create);
  router.get('/', validateQuery(subscriptionQuerySchema), controller.list);
  router.get('/:id', controller.getById);
  router.patch('/:id', validateBody(updateSubscriptionSchema), controller.update);
  router.post('/:id/archive', controller.archive);
  router.post('/:id/restore', controller.restore);

  // Subscription-scoped payments
  router.post('/:id/payments', validateBody(createPaymentSchema), paymentController.create);
  router.get(
    '/:id/payments',
    validateQuery(paymentQuerySchema),
    paymentController.listForSubscription,
  );

  return router;
}
