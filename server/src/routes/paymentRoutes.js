import { Router } from 'express';

import { createPaymentController } from '../controllers/paymentController.js';
import { createRefundController } from '../controllers/refundController.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createPaymentRepository } from '../repositories/paymentRepository.js';
import { createRefundRepository } from '../repositories/refundRepository.js';
import { createSubscriptionRepository } from '../repositories/subscriptionRepository.js';
import { createPaymentService } from '../services/paymentService.js';
import { createRefundService } from '../services/refundService.js';
import {
  createRefundSchema,
  idParamsSchema,
  paymentQuerySchema,
  updatePaymentSchema,
} from '../validation/schemas.js';

export function createPaymentRouter(database, authenticate) {
  const router = Router();

  const paymentRepository = createPaymentRepository(database);
  const refundRepository = createRefundRepository(database);
  const subscriptionRepository = createSubscriptionRepository(database);

  const paymentService = createPaymentService({
    database,
    paymentRepository,
    refundRepository,
    subscriptionRepository,
  });

  const refundService = createRefundService({
    database,
    paymentRepository,
    refundRepository,
  });

  const paymentController = createPaymentController(paymentService);
  const refundController = createRefundController(refundService);

  const withId = validateParams(idParamsSchema);

  router.use(authenticate);

  // Payment listing and details
  router.get('/', validateQuery(paymentQuerySchema), paymentController.list);
  router.get('/:id', withId, paymentController.getById);
  router.patch('/:id', withId, validateBody(updatePaymentSchema), paymentController.update);

  // Refund sub-resource routes
  router.get('/:id/refunds', withId, refundController.list);
  router.post('/:id/refunds', withId, validateBody(createRefundSchema), refundController.create);

  return {
    controller: paymentController,
    repository: paymentRepository,
    router,
    service: paymentService,
  };
}
