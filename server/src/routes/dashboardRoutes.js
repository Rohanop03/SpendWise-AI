import { Router } from 'express';
import { z } from 'zod';

import { validateQuery } from '../middleware/validate.js';
import { createAccountRepository } from '../repositories/accountRepository.js';
import { createAnalyticsRepository } from '../repositories/analyticsRepository.js';
import { createBillingRepository } from '../repositories/billingRepository.js';
import { createRecommendationRepository } from '../repositories/recommendationRepository.js';
import { createAnalyticsService } from '../services/analyticsService.js';
import { createBillingService } from '../services/billingService.js';
import { validDateString } from '../validation/schemas.js';

const dashboardQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .optional(),
    days: z.coerce.number().int().min(1).max(365).default(30),
    endDate: validDateString.optional(),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine((data) => !(data.startDate && data.endDate) || data.endDate >= data.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

/**
 * Everything the dashboard shows on first load in one round trip. Each widget keeps the
 * response shape of its standalone endpoint; the queries run concurrently on the pool.
 */
export function createDashboardRouter(database, authenticate) {
  const router = Router();
  const analytics = createAnalyticsService(createAnalyticsRepository(database));
  const billing = createBillingService({ billingRepository: createBillingRepository(database) });
  const recommendations = createRecommendationRepository(database);
  const accounts = createAccountRepository(database);

  router.use(authenticate);
  router.get('/', validateQuery(dashboardQuerySchema), async (request, response) => {
    const userId = request.user.id;
    const { currencyCode, days, endDate, startDate } = request.validatedQuery;
    const range = { endDate, startDate, userId };
    const withCurrency = { ...range, currencyCode };

    const [
      overview,
      trends,
      categories,
      topSubscriptions,
      billingCycles,
      paymentStatus,
      refunds,
      renewals,
      recommendationSummary,
      recommendationPreviews,
      preferences,
    ] = await Promise.all([
      analytics.getFinancialOverview(range),
      analytics.getSpendingTrends({ ...withCurrency, interval: 'monthly' }),
      analytics.getCategoryAnalytics(withCurrency),
      currencyCode
        ? analytics.getTopSubscriptions({ ...withCurrency, limit: 5, type: 'historical' })
        : { subscriptions: [] },
      analytics.getBillingCycleAnalytics({ currencyCode, userId }),
      analytics.getPaymentStatusAnalytics(withCurrency),
      analytics.getRefundAnalytics({ ...withCurrency, limit: 5 }),
      billing.getUpcomingRenewals(userId, { days }),
      recommendations.summary(userId),
      recommendations.list({
        limit: 3,
        offset: 0,
        sortBy: 'priority',
        sortOrder: 'asc',
        status: 'Pending',
        userId,
      }),
      accounts.getPreferences(userId),
    ]);

    response.status(200).json({
      billingCycles,
      categories,
      overview,
      paymentStatus,
      preferences,
      recommendations: { previews: recommendationPreviews.items, summary: recommendationSummary },
      refunds,
      renewals,
      topSubscriptions,
      trends,
    });
  });

  return router;
}
