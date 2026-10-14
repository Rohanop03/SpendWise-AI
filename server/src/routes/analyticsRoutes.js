import { Router } from 'express';

import { createAnalyticsController } from '../controllers/analyticsController.js';
import { validateQuery } from '../middleware/validate.js';
import { createAnalyticsRepository } from '../repositories/analyticsRepository.js';
import { createAnalyticsService } from '../services/analyticsService.js';
import {
  analyticsBillingCyclesQuerySchema,
  analyticsCategoryQuerySchema,
  analyticsDateRangeSchema,
  analyticsRefundsQuerySchema,
  analyticsReportQuerySchema,
  analyticsSubscriptionsQuerySchema,
  analyticsTopSubscriptionsQuerySchema,
  analyticsTrendsQuerySchema,
} from '../validation/schemas.js';

export function createAnalyticsRouter(database, authenticate) {
  const router = Router();

  const analyticsRepository = createAnalyticsRepository(database);
  const analyticsService = createAnalyticsService(analyticsRepository);
  const analyticsController = createAnalyticsController(analyticsService);

  router.use(authenticate);

  router.get('/overview', validateQuery(analyticsDateRangeSchema), analyticsController.getOverview);
  router.get('/trends', validateQuery(analyticsTrendsQuerySchema), analyticsController.getTrends);
  router.get(
    '/categories',
    validateQuery(analyticsCategoryQuerySchema),
    analyticsController.getCategories,
  );
  router.get(
    '/subscriptions',
    validateQuery(analyticsSubscriptionsQuerySchema),
    analyticsController.getSubscriptions,
  );
  router.get(
    '/top-subscriptions',
    validateQuery(analyticsTopSubscriptionsQuerySchema),
    analyticsController.getTopSubscriptions,
  );
  router.get(
    '/billing-cycles',
    validateQuery(analyticsBillingCyclesQuerySchema),
    analyticsController.getBillingCycles,
  );
  router.get(
    '/payment-status',
    validateQuery(analyticsDateRangeSchema),
    analyticsController.getPaymentStatus,
  );
  router.get(
    '/refunds',
    validateQuery(analyticsRefundsQuerySchema),
    analyticsController.getRefunds,
  );
  router.get('/report', validateQuery(analyticsReportQuerySchema), analyticsController.getReport);
  router.get(
    '/report/export',
    validateQuery(analyticsReportQuerySchema),
    analyticsController.exportReportCsv,
  );

  return {
    controller: analyticsController,
    repository: analyticsRepository,
    router,
    service: analyticsService,
  };
}
