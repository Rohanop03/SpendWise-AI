import { AppError } from '../errors/AppError.js';

const notFound = () => new AppError(404, 'Recommendation not found.', { code: 'NOT_FOUND' });

export function createRecommendationService(database, repository, explanationService) {
  return {
    /** FR9: CALL generate_recommendations inside a transaction with the user row locked. */
    async generate(userId) {
      const counts = await database.withTransaction((transaction) =>
        repository.generate(transaction, userId),
      );
      return {
        generatedCount: counts.matchedCount,
        removedCount: counts.removedCount,
        summary: await repository.summary(userId),
      };
    },
    async list(userId, query) {
      const result = await repository.list({
        ...query,
        offset: (query.page - 1) * query.limit,
        userId,
      });
      return {
        pagination: {
          limit: query.limit,
          page: query.page,
          pages: Math.ceil(result.total / query.limit),
          total: result.total,
        },
        recommendations: result.items,
      };
    },
    async get(userId, id) {
      const item = await repository.findById(userId, id);
      if (!item) throw notFound();
      return item;
    },
    async summary(userId) {
      return repository.summary(userId);
    },
    async update(userId, id, status) {
      if (!(await repository.updateStatus(userId, id, status))) throw notFound();
      return repository.findById(userId, id);
    },
    async explain(userId, id) {
      return explanationService.explain(await this.get(userId, id));
    },
  };
}
