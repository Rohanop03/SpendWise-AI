import { AppError } from '../errors/AppError.js';
import { fromCents, toCents } from '../utils/money.js';
import {
  generateRecommendationCandidates,
  RECOMMENDATION_RULE_VERSION,
} from './recommendationEngine.js';

function requireId(id) {
  if (!/^\d+$/.test(String(id))) {
    throw new AppError(400, 'Recommendation ID must be a positive integer.', {
      code: 'VALIDATION_ERROR',
    });
  }
}

function summaryFrom(recommendations) {
  const counted = new Map();
  for (const item of recommendations) {
    if (!item.estimatedSavings || !item.currencyCode) continue;
    const subscriptionId = item.evidence?.savingsSubscriptionId;
    if (!subscriptionId) continue;
    const key = `${item.currencyCode}:${subscriptionId}`;
    const cents = toCents(item.estimatedSavings);
    counted.set(key, Math.max(counted.get(key) || 0, cents));
  }
  const totals = new Map();
  for (const [key, cents] of counted) {
    const currency = key.split(':')[0];
    totals.set(currency, (totals.get(currency) || 0) + cents);
  }
  return {
    activeCount: recommendations.length,
    highPriorityCount: recommendations.filter((item) => item.priority === 'high').length,
    hypotheticalMonthlySavings: [...totals].map(([currencyCode, cents]) => ({
      amount: fromCents(cents),
      currencyCode,
    })),
    limitation:
      'Hypothetical opportunities are deduplicated by underlying subscription and are not guaranteed or realized savings.',
  };
}

export function createRecommendationService(
  database,
  repository,
  explanationService,
  { clock = () => new Date() } = {},
) {
  return {
    async generate(userId) {
      const now = clock();
      const today = now.toISOString().slice(0, 10);
      const start = new Date(`${today}T00:00:00Z`);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      const candidates = await database.withTransaction(async (transaction) => {
        const inputs = await repository.getInputs(
          transaction,
          userId,
          start.toISOString().slice(0, 10),
          today,
        );
        const generated = generateRecommendationCandidates({ ...inputs, today });
        await repository.persist(transaction, userId, generated, now);
        return generated;
      });
      const active = await repository.list({
        limit: 100,
        offset: 0,
        sortBy: 'priority',
        sortOrder: 'asc',
        status: 'active',
        userId,
      });
      return {
        generatedCount: candidates.length,
        ruleVersion: RECOMMENDATION_RULE_VERSION,
        summary: summaryFrom(active.items),
      };
    },
    async list(userId, query) {
      const result = await repository.list({
        ...query,
        offset: (query.page - 1) * query.limit,
        userId,
      });
      return {
        recommendations: result.items,
        pagination: {
          limit: query.limit,
          page: query.page,
          pages: Math.ceil(result.total / query.limit),
          total: result.total,
        },
      };
    },
    async get(userId, id) {
      requireId(id);
      const item = await repository.findById(userId, id);
      if (!item) throw new AppError(404, 'Recommendation not found.', { code: 'NOT_FOUND' });
      return item;
    },
    async summary(userId) {
      const result = await repository.list({
        limit: 100,
        offset: 0,
        sortBy: 'priority',
        sortOrder: 'asc',
        status: 'active',
        userId,
      });
      return summaryFrom(result.items);
    },
    async update(userId, id, status) {
      requireId(id);
      const exists = await repository.findById(userId, id);
      if (!exists) throw new AppError(404, 'Recommendation not found.', { code: 'NOT_FOUND' });
      await repository.updateStatus(userId, id, status, clock());
      return repository.findById(userId, id);
    },
    async explain(userId, id) {
      return explanationService.explain(await this.get(userId, id));
    },
  };
}
