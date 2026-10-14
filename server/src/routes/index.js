import { Router } from 'express';

import { createAccountRouter } from './accountRoutes.js';
import { createAuthRouter } from './authRoutes.js';
import { createBillingRouter } from './billingRoutes.js';
import { createCategoryRouter, createServiceRouter } from './catalogRoutes.js';
import { createHealthRouter } from './healthRoutes.js';
import { createPaymentRouter } from './paymentRoutes.js';
import { createSubscriptionRouter } from './subscriptionRoutes.js';

export function createApiRouter(database, appConfig) {
  const router = Router();
  const auth = createAuthRouter(database, appConfig);

  router.use('/health', createHealthRouter(database));
  router.use('/auth', auth.router);
  router.use('/users', createAccountRouter(database, auth.authenticate));
  router.use('/categories', createCategoryRouter(database));
  router.use('/services', createServiceRouter(database));
  router.use('/subscriptions', createSubscriptionRouter(database, auth.authenticate));
  router.use('/payments', createPaymentRouter(database, auth.authenticate).router);
  router.use('/billing', createBillingRouter(database, auth.authenticate).router);

  return router;
}
