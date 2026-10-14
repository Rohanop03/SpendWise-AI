import { fromCents, toCents } from '../utils/money.js';

function mapRefund(row) {
  if (!row) {
    return null;
  }

  return {
    amount: fromCents(toCents(row.amount)),
    createdAt: row.created_at,
    id: String(row.id),
    paymentId: String(row.payment_id),
    reason: row.reason ?? null,
    refundDate: row.refund_date,
    refundStatus: row.refund_status,
  };
}

export function createRefundRepository(database) {
  return {
    async createRefund(input, client = database) {
      const result = await client.query(
        `
          INSERT INTO refunds (
            payment_id,
            amount,
            refund_date,
            refund_status,
            reason
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            payment_id,
            amount,
            refund_date::text AS refund_date,
            refund_status,
            reason,
            created_at
        `,
        [
          input.paymentId,
          input.amount,
          input.refundDate,
          input.refundStatus || 'completed',
          input.reason || null,
        ],
      );

      return mapRefund(result.rows[0]);
    },

    async listByPaymentId({ client = database, paymentId }) {
      const result = await client.query(
        `
          SELECT
            id,
            payment_id,
            amount,
            refund_date::text AS refund_date,
            refund_status,
            reason,
            created_at
          FROM refunds
          WHERE payment_id = $1
          ORDER BY refund_date DESC, id DESC
        `,
        [paymentId],
      );

      return result.rows.map(mapRefund);
    },

    async getCompletedRefundsTotal({ client = database, paymentId }) {
      const result = await client.query(
        `
          SELECT COALESCE(SUM(amount), 0) AS total_completed
          FROM refunds
          WHERE payment_id = $1 AND refund_status = 'completed'
        `,
        [paymentId],
      );

      return fromCents(toCents(result.rows[0].total_completed));
    },

    async findById({ client = database, id }) {
      const result = await client.query(
        `
          SELECT
            r.id,
            r.payment_id,
            r.amount,
            r.refund_date::text AS refund_date,
            r.refund_status,
            r.reason,
            r.created_at,
            s.user_id
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN subscriptions s ON s.id = p.subscription_id
          WHERE r.id = $1
        `,
        [id],
      );

      if (!result.rows[0]) {
        return null;
      }

      const refund = mapRefund(result.rows[0]);
      return {
        ...refund,
        userId: String(result.rows[0].user_id),
      };
    },
  };
}
