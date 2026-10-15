import { AppError } from '../errors/AppError.js';

export function createNotificationService(repository, { clock = () => new Date() } = {}) {
  return {
    countUnread(userId) {
      return repository.countUnread(userId);
    },
    async list(userId, query) {
      const result = await repository.list({
        ...query,
        offset: (query.page - 1) * query.limit,
        userId,
      });
      return {
        notifications: result.items,
        pagination: {
          limit: query.limit,
          page: query.page,
          pages: Math.ceil(result.total / query.limit),
          total: result.total,
        },
      };
    },
    async markAllRead(userId) {
      const updatedCount = await repository.markAllRead(userId, clock());
      return { updatedCount };
    },
    async markRead(userId, id) {
      if (!/^\d+$/.test(id)) {
        throw new AppError(400, 'Notification ID must be a positive integer.', {
          code: 'VALIDATION_ERROR',
        });
      }
      const notification = await repository.markRead({ id, readAt: clock(), userId });
      if (!notification) {
        throw new AppError(404, 'Notification not found.', { code: 'NOT_FOUND' });
      }
      return notification;
    },
  };
}
