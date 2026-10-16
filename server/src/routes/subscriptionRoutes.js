import { Router } from 'express';

import { createPaymentController } from '../controllers/paymentController.js';
import { createSubscriptionController } from '../controllers/subscriptionController.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createAccountRepository } from '../repositories/accountRepository.js';
import { createPaymentRepository } from '../repositories/paymentRepository.js';
import { createRefundRepository } from '../repositories/refundRepository.js';
import { createSubscriptionRepository } from '../repositories/subscriptionRepository.js';
import { createPaymentService } from '../services/paymentService.js';
import { createSubscriptionService } from '../services/subscriptionService.js';
import {
  cancelSubscriptionSchema,
  createPaymentSchema,
  createSubscriptionSchema,
  idParamsSchema,
  markUsedSchema,
  paymentQuerySchema,
  subscriptionHistoryQuerySchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from '../validation/schemas.js';

export function createSubscriptionRouter(database, authenticate) {
  const router = Router();
  const repository = createSubscriptionRepository(database);
  const paymentRepository = createPaymentRepository(database);
  const refundRepository = createRefundRepository(database);
  const service = createSubscriptionService(repository, {
    database,
    paymentRepository,
    userRepository: createAccountRepository(database),
  });
  const controller = createSubscriptionController(service);

  const paymentService = createPaymentService({
    database,
    paymentRepository,
    refundRepository,
    subscriptionRepository: repository,
  });
  const paymentController = createPaymentController(paymentService);
  const withId = validateParams(idParamsSchema);

  router.use(authenticate);

  router.post('/', validateBody(createSubscriptionSchema), controller.create);
  router.get('/', validateQuery(subscriptionQuerySchema), controller.list);
  router.get('/:id', withId, controller.getById);
  router.patch('/:id', withId, validateBody(updateSubscriptionSchema), controller.update);
  router.delete('/:id', withId, controller.delete);
  router.post('/:id/archive', withId, controller.archive);
  router.post('/:id/restore', withId, controller.restore);
  router.post('/:id/cancel', withId, validateBody(cancelSubscriptionSchema), controller.cancel);
  router.patch('/:id/used', withId, validateBody(markUsedSchema), controller.markUsed);
  router.get(
    '/:id/history',
    withId,
    validateQuery(subscriptionHistoryQuerySchema),
    controller.history,
  );

  // Subscription-scoped payments
  router.post('/:id/payments', withId, validateBody(createPaymentSchema), paymentController.create);
  router.get(
    '/:id/payments',
    withId,
    validateQuery(paymentQuerySchema),
    paymentController.listForSubscription,
  );

  return router;
}
