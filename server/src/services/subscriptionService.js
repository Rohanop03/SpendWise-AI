import { AppError } from '../errors/AppError.js';

export function createSubscriptionService(subscriptionRepository) {
  return {
    async archiveSubscription(userId, id) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      if (existing.archivedAt) {
        return existing;
      }

      const archived = await subscriptionRepository.archiveSubscription({ id, userId });
      return archived;
    },

    async createSubscription(userId, input) {
      const categoryValid = await subscriptionRepository.categoryExists(input.categoryId);
      if (!categoryValid) {
        throw new AppError(400, 'Selected category does not exist.', {
          code: 'INVALID_CATEGORY',
        });
      }

      if (input.serviceId) {
        const serviceValid = await subscriptionRepository.serviceExists(input.serviceId);
        if (!serviceValid) {
          throw new AppError(400, 'Selected service does not exist or is inactive.', {
            code: 'INVALID_SERVICE',
          });
        }
      }

      return subscriptionRepository.createSubscription({
        ...input,
        userId,
      });
    },

    async getSubscription(userId, id) {
      const subscription = await subscriptionRepository.findById({ id, userId });
      if (!subscription) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      return subscription;
    },

    async listSubscriptions(userId, query) {
      return subscriptionRepository.listSubscriptions({
        ...query,
        userId,
      });
    },

    async restoreSubscription(userId, id) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      if (!existing.archivedAt) {
        return existing;
      }

      const restored = await subscriptionRepository.restoreSubscription({ id, userId });
      return restored;
    },

    async updateSubscription(userId, id, updates) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      if (existing.archivedAt) {
        throw new AppError(
          400,
          'Cannot update an archived subscription. Please restore it first.',
          { code: 'SUBSCRIPTION_ARCHIVED' },
        );
      }

      if (updates.categoryId) {
        const categoryValid = await subscriptionRepository.categoryExists(updates.categoryId);
        if (!categoryValid) {
          throw new AppError(400, 'Selected category does not exist.', {
            code: 'INVALID_CATEGORY',
          });
        }
      }

      if (updates.serviceId) {
        const serviceValid = await subscriptionRepository.serviceExists(updates.serviceId);
        if (!serviceValid) {
          throw new AppError(400, 'Selected service does not exist or is inactive.', {
            code: 'INVALID_SERVICE',
          });
        }
      }

      // Validate merged state against database check constraints
      const effectiveStatus = updates.status ?? existing.status;
      const effectiveStartDate = updates.startDate ?? existing.startDate;
      const effectiveNextRenewal =
        updates.nextRenewalDate !== undefined ? updates.nextRenewalDate : existing.nextRenewalDate;
      const effectiveTrialEnd =
        updates.trialEndDate !== undefined ? updates.trialEndDate : existing.trialEndDate;

      if (effectiveStatus === 'active' || effectiveStatus === 'trial') {
        if (!effectiveNextRenewal) {
          throw new AppError(
            400,
            'Next renewal date is required for active or trial subscriptions.',
            { code: 'INVALID_RENEWAL_DATE' },
          );
        }
        if (effectiveNextRenewal < effectiveStartDate) {
          throw new AppError(400, 'Next renewal date must be on or after start date.', {
            code: 'INVALID_RENEWAL_DATE',
          });
        }
      }

      if (effectiveStatus === 'trial') {
        if (!effectiveTrialEnd) {
          throw new AppError(400, 'Trial end date is required when status is trial.', {
            code: 'INVALID_TRIAL_END_DATE',
          });
        }
        if (effectiveTrialEnd < effectiveStartDate) {
          throw new AppError(400, 'Trial end date must be on or after start date.', {
            code: 'INVALID_TRIAL_END_DATE',
          });
        }
      }

      return subscriptionRepository.updateSubscription({
        id,
        updates,
        userId,
      });
    },
  };
}
