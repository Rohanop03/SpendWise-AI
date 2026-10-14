import { fromCents, subtractMoney, toCents } from '../utils/money.js';

function mapPayment(row) {
  if (!row) {
    return null;
  }

  const amountStr = fromCents(toCents(row.amount));
  const totalRefundedStr = fromCents(toCents(row.total_refunded || 0));
  const isCompleted = row.payment_status === 'completed';
  const netAmountStr = isCompleted ? subtractMoney(amountStr, totalRefundedStr) : '0.00';
  const remainingRefundableStr = isCompleted ? subtractMoney(amountStr, totalRefundedStr) : '0.00';

  return {
    amount: amountStr,
    billingPeriodEnd: row.billing_period_end ?? null,
    billingPeriodStart: row.billing_period_start ?? null,
    categoryName: row.category_name ?? null,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    customServiceName: row.custom_service_name ?? null,
    id: String(row.id),
    netAmount: netAmountStr,
    notes: row.notes ?? null,
    paymentDate: row.payment_date,
    paymentStatus: row.payment_status,
    planName: row.plan_name ?? null,
    refundCount: Number(row.refund_count || 0),
    remainingRefundable: remainingRefundableStr,
    serviceName: row.service_name ?? row.custom_service_name,
    subscriptionId: String(row.subscription_id),
    totalRefunded: totalRefundedStr,
    updatedAt: row.updated_at,
    userId: row.user_id ? String(row.user_id) : undefined,
  };
}

const sortColumnMap = {
  amount: 'p.amount',
  createdAt: 'p.created_at',
  paymentDate: 'p.payment_date',
};

export function createPaymentRepository(database) {
  return {
    async createPayment(input, client = database) {
      const result = await client.query(
        `
          INSERT INTO payments (
            subscription_id,
            amount,
            currency_code,
            payment_date,
            payment_status,
            billing_period_start,
            billing_period_end,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            subscription_id,
            amount,
            currency_code,
            payment_date::text AS payment_date,
            payment_status,
            billing_period_start::text AS billing_period_start,
            billing_period_end::text AS billing_period_end,
            notes,
            created_at,
            updated_at
        `,
        [
          input.subscriptionId,
          input.amount,
          input.currencyCode,
          input.paymentDate,
          input.paymentStatus,
          input.billingPeriodStart || null,
          input.billingPeriodEnd || null,
          input.notes || null,
        ],
      );

      return mapPayment(result.rows[0]);
    },

    async findById({ id, userId, client = database }) {
      const result = await client.query(
        `
          SELECT
            p.id,
            p.subscription_id,
            p.amount,
            p.currency_code,
            p.payment_date::text AS payment_date,
            p.payment_status,
            p.billing_period_start::text AS billing_period_start,
            p.billing_period_end::text AS billing_period_end,
            p.notes,
            p.created_at,
            p.updated_at,
            s.user_id,
            s.plan_name,
            s.billing_cycle,
            COALESCE(svc.name, s.custom_service_name) AS service_name,
            s.custom_service_name,
            cat.name AS category_name,
            COALESCE(
              (
                SELECT SUM(r.amount)
                FROM refunds r
                WHERE r.payment_id = p.id AND r.refund_status = 'completed'
              ),
              0
            ) AS total_refunded,
            (
              SELECT COUNT(*)::int
              FROM refunds r
              WHERE r.payment_id = p.id
            ) AS refund_count
          FROM payments p
          JOIN subscriptions s ON s.id = p.subscription_id
          LEFT JOIN services svc ON svc.id = s.service_id
          JOIN categories cat ON cat.id = s.category_id
          WHERE p.id = $1 AND s.user_id = $2
        `,
        [id, userId],
      );

      return mapPayment(result.rows[0]);
    },

    async lockPaymentForUpdate({ id, userId, client = database }) {
      const result = await client.query(
        `
          SELECT
            p.id,
            p.subscription_id,
            p.amount,
            p.currency_code,
            p.payment_status,
            p.payment_date::text AS payment_date,
            s.user_id
          FROM payments p
          JOIN subscriptions s ON s.id = p.subscription_id
          WHERE p.id = $1 AND s.user_id = $2
          FOR UPDATE OF p
        `,
        [id, userId],
      );

      return result.rows[0]
        ? {
            amount: fromCents(toCents(result.rows[0].amount)),
            currencyCode: result.rows[0].currency_code,
            id: String(result.rows[0].id),
            paymentDate: result.rows[0].payment_date,
            paymentStatus: result.rows[0].payment_status,
            subscriptionId: String(result.rows[0].subscription_id),
            userId: String(result.rows[0].user_id),
          }
        : null;
    },

    async listPayments({
      client = database,
      currencyCode,
      endDate,
      limit = 10,
      offset = 0,
      paymentStatus,
      sortBy = 'paymentDate',
      sortOrder = 'desc',
      startDate,
      subscriptionId,
      userId,
    }) {
      const conditions = ['s.user_id = $1'];
      const parameters = [userId];

      if (subscriptionId) {
        parameters.push(subscriptionId);
        conditions.push(`p.subscription_id = $${parameters.length}`);
      }

      if (paymentStatus) {
        parameters.push(paymentStatus);
        conditions.push(`p.payment_status = $${parameters.length}`);
      }

      if (currencyCode) {
        parameters.push(currencyCode);
        conditions.push(`p.currency_code = $${parameters.length}`);
      }

      if (startDate) {
        parameters.push(startDate);
        conditions.push(`p.payment_date >= $${parameters.length}`);
      }

      if (endDate) {
        parameters.push(endDate);
        conditions.push(`p.payment_date <= $${parameters.length}`);
      }

      const sortColumn = sortColumnMap[sortBy] || 'p.payment_date';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      parameters.push(limit);
      const limitParamIndex = parameters.length;

      parameters.push(offset);
      const offsetParamIndex = parameters.length;

      const query = `
        SELECT
          p.id,
          p.subscription_id,
          p.amount,
          p.currency_code,
          p.payment_date::text AS payment_date,
          p.payment_status,
          p.billing_period_start::text AS billing_period_start,
          p.billing_period_end::text AS billing_period_end,
          p.notes,
          p.created_at,
          p.updated_at,
          s.user_id,
          s.plan_name,
          s.billing_cycle,
          COALESCE(svc.name, s.custom_service_name) AS service_name,
          s.custom_service_name,
          cat.name AS category_name,
          COALESCE(
            (
              SELECT SUM(r.amount)
              FROM refunds r
              WHERE r.payment_id = p.id AND r.refund_status = 'completed'
            ),
            0
          ) AS total_refunded,
          (
            SELECT COUNT(*)::int
            FROM refunds r
            WHERE r.payment_id = p.id
          ) AS refund_count
        FROM payments p
        JOIN subscriptions s ON s.id = p.subscription_id
        LEFT JOIN services svc ON svc.id = s.service_id
        JOIN categories cat ON cat.id = s.category_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${sortColumn} ${order}, p.id DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;

      const result = await client.query(query, parameters);
      return result.rows.map(mapPayment);
    },

    async countPayments({
      client = database,
      currencyCode,
      endDate,
      paymentStatus,
      startDate,
      subscriptionId,
      userId,
    }) {
      const conditions = ['s.user_id = $1'];
      const parameters = [userId];

      if (subscriptionId) {
        parameters.push(subscriptionId);
        conditions.push(`p.subscription_id = $${parameters.length}`);
      }

      if (paymentStatus) {
        parameters.push(paymentStatus);
        conditions.push(`p.payment_status = $${parameters.length}`);
      }

      if (currencyCode) {
        parameters.push(currencyCode);
        conditions.push(`p.currency_code = $${parameters.length}`);
      }

      if (startDate) {
        parameters.push(startDate);
        conditions.push(`p.payment_date >= $${parameters.length}`);
      }

      if (endDate) {
        parameters.push(endDate);
        conditions.push(`p.payment_date <= $${parameters.length}`);
      }

      const query = `
        SELECT COUNT(*)::int AS total
        FROM payments p
        JOIN subscriptions s ON s.id = p.subscription_id
        WHERE ${conditions.join(' AND ')}
      `;

      const result = await client.query(query, parameters);
      return result.rows[0].total;
    },

    async updatePayment({ client = database, id, updates }) {
      const setClauses = [];
      const parameters = [];

      if (updates.amount !== undefined) {
        parameters.push(updates.amount);
        setClauses.push(`amount = $${parameters.length}`);
      }

      if (updates.paymentStatus !== undefined) {
        parameters.push(updates.paymentStatus);
        setClauses.push(`payment_status = $${parameters.length}`);
      }

      if (updates.paymentDate !== undefined) {
        parameters.push(updates.paymentDate);
        setClauses.push(`payment_date = $${parameters.length}`);
      }

      if (updates.billingPeriodStart !== undefined) {
        parameters.push(updates.billingPeriodStart || null);
        setClauses.push(`billing_period_start = $${parameters.length}`);
      }

      if (updates.billingPeriodEnd !== undefined) {
        parameters.push(updates.billingPeriodEnd || null);
        setClauses.push(`billing_period_end = $${parameters.length}`);
      }

      if (updates.notes !== undefined) {
        parameters.push(updates.notes || null);
        setClauses.push(`notes = $${parameters.length}`);
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      parameters.push(id);
      const idParam = parameters.length;

      const query = `
        UPDATE payments
        SET ${setClauses.join(', ')}
        WHERE id = $${idParam}
        RETURNING
          id,
          subscription_id,
          amount,
          currency_code,
          payment_date::text AS payment_date,
          payment_status,
          billing_period_start::text AS billing_period_start,
          billing_period_end::text AS billing_period_end,
          notes,
          created_at,
          updated_at
      `;

      const result = await client.query(query, parameters);
      return mapPayment(result.rows[0]);
    },
  };
}
