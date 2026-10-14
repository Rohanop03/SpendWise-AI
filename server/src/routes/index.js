import { Router } from 'express';

import { createAccountRouter } from './accountRoutes.js';
import { createAuthRouter } from './authRoutes.js';
import { createCategoryRouter, createServiceRouter } from './catalogRoutes.js';
import { createHealthRouter } from './healthRoutes.js';
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

  return router;
}
