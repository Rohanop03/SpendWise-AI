import { AppError } from '../errors/AppError.js';
import { compareMoney, isPositiveMoney } from '../utils/money.js';

export function createPaymentService({
  database,
  paymentRepository,
  refundRepository,
  subscriptionRepository,
}) {
  return {
    /**
     * FR5: the AFTER INSERT trigger on payment_history advances the subscription's
     * renewal_date; the response carries the subscription as the trigger left it.
     */
    async createPayment(userId, subscriptionId, input) {
      const subscription = await subscriptionRepository.findById({
        id: subscriptionId,
        userId,
      });

      if (!subscription) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      const currencyCode = input.currencyCode ?? subscription.currencyCode;
      if (currencyCode !== subscription.currencyCode) {
        throw new AppError(
          400,
          `Payment currency must match the subscription currency (${subscription.currencyCode}).`,
          { code: 'CURRENCY_MISMATCH' },
        );
      }

      const payment = await paymentRepository.createPayment({
        amount: input.amount,
        billingPeriodEnd: input.billingPeriodEnd,
        billingPeriodStart: input.billingPeriodStart,
        currencyCode,
        notes: input.notes,
        paymentDate: input.paymentDate,
        paymentStatus: input.paymentStatus || 'completed',
        subscriptionId,
      });

      return {
        payment,
        subscription: await subscriptionRepository.findById({ id: subscriptionId, userId }),
      };
    },

    async getPayment(userId, id) {
      const payment = await paymentRepository.findById({ id, userId });
      if (!payment) {
        throw new AppError(404, 'Payment not found.', { code: 'NOT_FOUND' });
      }

      const refunds = await refundRepository.listByPaymentId({ paymentId: id });
      return {
        ...payment,
        refunds,
      };
    },

    async listPayments(userId, query = {}) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const offset = (page - 1) * limit;

      const effectiveStatus = query.paymentStatus || query.status;

      const params = {
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        limit,
        offset,
        paymentStatus: effectiveStatus,
        sortBy: query.sortBy || 'paymentDate',
        sortOrder: query.sortOrder || 'desc',
        startDate: query.startDate,
        subscriptionId: query.subscriptionId,
        userId,
      };

      const [items, totalCount] = await Promise.all([
        paymentRepository.listPayments(params),
        paymentRepository.countPayments(params),
      ]);

      return {
        items,
        pagination: {
          limit,
          page,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
      };
    },

    async listSubscriptionPayments(userId, subscriptionId, query = {}) {
      const subscription = await subscriptionRepository.findById({
        id: subscriptionId,
        userId,
      });

      if (!subscription) {
        throw new AppError(404, 'Subscription not found.', { code: 'NOT_FOUND' });
      }

      return this.listPayments(userId, {
        ...query,
        subscriptionId,
      });
    },

    async updatePayment(userId, id, updates) {
      return database.withTransaction(async (transaction) => {
        const locked = await paymentRepository.lockPaymentForUpdate({
          client: transaction,
          id,
          userId,
        });

        if (!locked) {
          throw new AppError(404, 'Payment not found.', { code: 'NOT_FOUND' });
        }

        const totalCompletedRefunds = await refundRepository.getCompletedRefundsTotal({
          client: transaction,
          paymentId: id,
        });

        // 1. If amount is changing, ensure it is not reduced below existing completed refunds
        if (updates.amount !== undefined) {
          if (compareMoney(updates.amount, totalCompletedRefunds) < 0) {
            throw new AppError(
              400,
              `Payment amount cannot be reduced below completed refunds total of ${totalCompletedRefunds}.`,
              { code: 'PAYMENT_BELOW_REFUNDS' },
            );
          }
        }

        // 2. If status is changing and completed refunds exist, cannot mark failed or cancelled
        if (updates.paymentStatus !== undefined && updates.paymentStatus !== locked.paymentStatus) {
          if (locked.paymentStatus === 'completed' && isPositiveMoney(totalCompletedRefunds)) {
            if (updates.paymentStatus !== 'completed') {
              throw new AppError(
                400,
                'Cannot change status of a completed payment that has completed refunds.',
                { code: 'PAYMENT_HAS_REFUNDS' },
              );
            }
          }
        }

        // 3. Billing period validation if partially updated
        const existingFull = await paymentRepository.findById({
          client: transaction,
          id,
          userId,
        });

        const effectiveStart =
          updates.billingPeriodStart !== undefined
            ? updates.billingPeriodStart
            : existingFull.billingPeriodStart;
        const effectiveEnd =
          updates.billingPeriodEnd !== undefined
            ? updates.billingPeriodEnd
            : existingFull.billingPeriodEnd;

        if ((effectiveStart && !effectiveEnd) || (!effectiveStart && effectiveEnd)) {
          throw new AppError(
            400,
            'Billing period start and end must both be set or both be empty.',
            { code: 'INVALID_BILLING_PERIOD' },
          );
        }

        if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
          throw new AppError(
            400,
            'Billing period end date must be on or after billing period start date.',
            { code: 'INVALID_BILLING_PERIOD' },
          );
        }

        const updated = await paymentRepository.updatePayment({
          client: transaction,
          id,
          updates,
        });

        return updated;
      });
    },
  };
}
