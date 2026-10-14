import { AppError } from '../errors/AppError.js';
import { addMoney, compareMoney, subtractMoney } from '../utils/money.js';

export function createRefundService({ database, paymentRepository, refundRepository }) {
  return {
    async createRefund(userId, paymentId, input) {
      return database.withTransaction(async (transaction) => {
        // 1. Acquire row lock on parent payment row ensuring serialized concurrency
        const payment = await paymentRepository.lockPaymentForUpdate({
          client: transaction,
          id: paymentId,
          userId,
        });

        if (!payment) {
          throw new AppError(404, 'Payment not found.', { code: 'NOT_FOUND' });
        }

        // 2. Only completed payments are eligible for refunds
        if (payment.paymentStatus !== 'completed') {
          throw new AppError(400, 'Refunds can only be recorded against completed payments.', {
            code: 'INVALID_PAYMENT_STATUS',
          });
        }

        // 3. Read current completed refund total under the lock
        const totalCompletedRefunds = await refundRepository.getCompletedRefundsTotal({
          client: transaction,
          paymentId,
        });

        const remainingRefundable = subtractMoney(payment.amount, totalCompletedRefunds);

        // 4. Invariant check: refund amount cannot exceed remaining refundable balance
        if (compareMoney(input.amount, remainingRefundable) > 0) {
          throw new AppError(
            400,
            `Refund amount of ${input.amount} exceeds remaining refundable balance of ${remainingRefundable}.`,
            {
              code: 'EXCESSIVE_REFUND',
              details: {
                paymentAmount: payment.amount,
                remainingRefundable,
                requestedAmount: input.amount,
                totalRefunded: totalCompletedRefunds,
              },
            },
          );
        }

        // 5. Insert refund record
        const refund = await refundRepository.createRefund(
          {
            amount: input.amount,
            paymentId,
            reason: input.reason,
            refundDate: input.refundDate,
            refundStatus: input.refundStatus || 'completed',
          },
          transaction,
        );

        const isCompleted = (input.refundStatus || 'completed') === 'completed';
        const newTotalRefunded = isCompleted
          ? addMoney(totalCompletedRefunds, input.amount)
          : totalCompletedRefunds;
        const newNetAmount = subtractMoney(payment.amount, newTotalRefunded);
        const newRemainingRefundable = subtractMoney(payment.amount, newTotalRefunded);

        return {
          paymentSummary: {
            currencyCode: payment.currencyCode,
            netAmount: newNetAmount,
            paymentAmount: payment.amount,
            paymentId: String(payment.id),
            remainingRefundable: newRemainingRefundable,
            totalRefunded: newTotalRefunded,
          },
          refund,
        };
      });
    },

    async listRefunds(userId, paymentId) {
      const payment = await paymentRepository.findById({ id: paymentId, userId });
      if (!payment) {
        throw new AppError(404, 'Payment not found.', { code: 'NOT_FOUND' });
      }

      const refunds = await refundRepository.listByPaymentId({ paymentId });
      return {
        payment,
        refunds,
      };
    },
  };
}
