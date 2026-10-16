import { AppError } from '../errors/AppError.js';
import { getUserToday } from '../utils/reminderDates.js';

const notFound = () => new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });

export function createSubscriptionService(
  subscriptionRepository,
  { clock = () => new Date(), database, paymentRepository, userRepository } = {},
) {
  async function todayFor(userId, client) {
    return getUserToday(await userRepository.getTimezone(userId, client), clock());
  }

  async function assertLastUsedNotInFuture(userId, lastUsedDate) {
    if (lastUsedDate && lastUsedDate > (await todayFor(userId))) {
      throw new AppError(400, 'Last used date cannot be in the future.', {
        code: 'INVALID_LAST_USED_DATE',
      });
    }
  }

  return {
    async archiveSubscription(userId, id) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) throw notFound();
      if (existing.archivedAt) return existing;
      return subscriptionRepository.archiveSubscription({ id, userId });
    },

    async createSubscription(userId, input) {
      if (!(await subscriptionRepository.categoryExists(input.categoryId))) {
        throw new AppError(400, 'Selected category does not exist.', { code: 'INVALID_CATEGORY' });
      }
      await assertLastUsedNotInFuture(userId, input.lastUsedDate);

      return subscriptionRepository.createSubscription({ ...input, userId });
    },

    /** FR2 delete: hard delete; payments, refunds, reminders and audit rows cascade in SQL. */
    async deleteSubscription(userId, id) {
      await database.withTransaction(async (transaction) => {
        const locked = await subscriptionRepository.lockForUpdate({
          client: transaction,
          id,
          userId,
        });
        if (!locked) throw notFound();
        await subscriptionRepository.deleteSubscription({ client: transaction, id, userId });
      });
    },

    /**
     * Spec transaction: status -> Cancelled and the optional final payment commit together.
     * The row is locked first and cancelled before the payment is inserted, so the renewal
     * trigger sees a Cancelled subscription and leaves renewal_date alone.
     */
    async cancelSubscription(userId, id, { finalPayment } = {}) {
      return database.withTransaction(async (transaction) => {
        const locked = await subscriptionRepository.lockForUpdate({
          client: transaction,
          id,
          userId,
        });
        if (!locked) throw notFound();
        if (locked.archived_at) {
          throw new AppError(400, 'Restore the subscription before cancelling it.', {
            code: 'SUBSCRIPTION_ARCHIVED',
          });
        }
        if (locked.status === 'Cancelled') {
          throw new AppError(409, 'Subscription is already cancelled.', {
            code: 'ALREADY_CANCELLED',
          });
        }

        await subscriptionRepository.updateSubscription({
          client: transaction,
          id,
          updates: { status: 'Cancelled' },
          userId,
        });

        let payment = null;
        if (finalPayment) {
          payment = await paymentRepository.createPayment(
            {
              amount: finalPayment.amount,
              currencyCode: locked.currency_code,
              notes: finalPayment.notes ?? 'Final payment on cancellation.',
              paymentDate: finalPayment.paymentDate,
              paymentStatus: 'completed',
              subscriptionId: id,
            },
            transaction,
          );
        }

        const subscription = await subscriptionRepository.findById({
          client: transaction,
          id,
          userId,
        });
        return { payment, subscription };
      });
    },

    async getHistory(userId, id, { limit = 50 } = {}) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) throw notFound();
      return subscriptionRepository.listHistory({ id, limit, userId });
    },

    async getSubscription(userId, id) {
      const subscription = await subscriptionRepository.findById({ id, userId });
      if (!subscription) throw notFound();
      return subscription;
    },

    async listSubscriptions(userId, query) {
      return subscriptionRepository.listSubscriptions({ ...query, userId });
    },

    /** FR8 input: records use today (the user's local date) unless a date is given. */
    async markUsed(userId, id, { lastUsedDate } = {}) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) throw notFound();

      const date = lastUsedDate ?? (await todayFor(userId));
      await assertLastUsedNotInFuture(userId, date);
      if (date < existing.startDate) {
        throw new AppError(400, 'Last used date must be on or after the start date.', {
          code: 'INVALID_LAST_USED_DATE',
        });
      }

      return subscriptionRepository.updateSubscription({
        id,
        updates: { lastUsedDate: date },
        userId,
      });
    },

    async restoreSubscription(userId, id) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) throw notFound();
      if (!existing.archivedAt) return existing;
      return subscriptionRepository.restoreSubscription({ id, userId });
    },

    async updateSubscription(userId, id, updates) {
      const existing = await subscriptionRepository.findById({ id, userId });
      if (!existing) throw notFound();

      if (existing.archivedAt) {
        throw new AppError(400, 'Cannot update an archived subscription. Please restore it first.', {
          code: 'SUBSCRIPTION_ARCHIVED',
        });
      }

      if (updates.categoryId && !(await subscriptionRepository.categoryExists(updates.categoryId))) {
        throw new AppError(400, 'Selected category does not exist.', { code: 'INVALID_CATEGORY' });
      }

      const startDate = updates.startDate ?? existing.startDate;
      const renewalDate = updates.renewalDate ?? existing.renewalDate;
      const lastUsedDate =
        updates.lastUsedDate !== undefined ? updates.lastUsedDate : existing.lastUsedDate;

      if (renewalDate < startDate) {
        throw new AppError(400, 'Renewal date must be on or after start date.', {
          code: 'INVALID_RENEWAL_DATE',
        });
      }
      if (lastUsedDate && lastUsedDate < startDate) {
        throw new AppError(400, 'Last used date must be on or after the start date.', {
          code: 'INVALID_LAST_USED_DATE',
        });
      }
      if (updates.lastUsedDate) await assertLastUsedNotInFuture(userId, updates.lastUsedDate);

      return subscriptionRepository.updateSubscription({ id, updates, userId });
    },
  };
}
