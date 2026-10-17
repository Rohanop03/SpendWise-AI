import { fromCents, subtractMoney, toCents } from '../utils/money.js';

function mapPayment(row) {
  if (!row) {
    return null;
  }

  const amountStr = fromCents(toCents(row.amount));
  const totalRefundedStr = fromCents(toCents(row.total_refunded || 0));
  const isCompleted = row.payment_status === 'completed';
  const netAmountStr = isCompleted ? subtractMoney(amountStr, totalRefundedStr) : '0.00';

  return {
    amount: amountStr,
    billingPeriodEnd: row.billing_period_end ?? null,
    billingPeriodStart: row.billing_period_start ?? null,
    categoryName: row.category_name ?? null,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    id: String(row.payment_id),
    netAmount: netAmountStr,
    notes: row.notes ?? null,
    paymentDate: row.payment_date,
    paymentStatus: row.payment_status,
    planName: row.plan_name ?? null,
    refundCount: Number(row.refund_count || 0),
    remainingRefundable: netAmountStr,
    serviceName: row.service_name ?? null,
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

const paymentColumns = `
  payment_id,
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

// Refund totals per payment are correlated subqueries (one index probe each).
const detailedSelect = `
  SELECT
    p.payment_id,
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
    s.service_name,
    cat.category_name,
    COALESCE(
      (SELECT SUM(r.amount) FROM refunds r
       WHERE r.payment_id = p.payment_id AND r.refund_status = 'completed'),
      0
    ) AS total_refunded,
    (SELECT COUNT(*)::int FROM refunds r WHERE r.payment_id = p.payment_id) AS refund_count
  FROM payment_history p
  JOIN subscription s ON s.subscription_id = p.subscription_id
  JOIN category cat ON cat.category_id = s.category_id
`;

function buildFilters({ currencyCode, endDate, paymentStatus, startDate, subscriptionId, userId }) {
  const conditions = ['s.user_id = $1'];
  const parameters = [userId];
  const add = (sql, value) => {
    parameters.push(value);
    conditions.push(sql.replace('?', `$${parameters.length}`));
  };

  if (subscriptionId) add('p.subscription_id = ?', subscriptionId);
  if (paymentStatus) add('p.payment_status = ?', paymentStatus);
  if (currencyCode) add('p.currency_code = ?', currencyCode);
  if (startDate) add('p.payment_date >= ?', startDate);
  if (endDate) add('p.payment_date <= ?', endDate);

  return { parameters, where: conditions.join(' AND ') };
}

export function createPaymentRepository(database) {
  return {
    async createPayment(input, client = database) {
      const result = await client.query(
        `
          INSERT INTO payment_history (
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
          RETURNING ${paymentColumns}
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

    async findById({ client = database, id, userId }) {
      const result = await client.query(
        `${detailedSelect} WHERE p.payment_id = $1 AND s.user_id = $2`,
        [id, userId],
      );

      return mapPayment(result.rows[0]);
    },

    async lockPaymentForUpdate({ client = database, id, userId }) {
      const result = await client.query(
        `
          SELECT
            p.payment_id,
            p.subscription_id,
            p.amount,
            p.currency_code,
            p.payment_status,
            p.payment_date::text AS payment_date,
            s.user_id
          FROM payment_history p
          JOIN subscription s ON s.subscription_id = p.subscription_id
          WHERE p.payment_id = $1 AND s.user_id = $2
          FOR UPDATE OF p
        `,
        [id, userId],
      );

      const row = result.rows[0];
      return row
        ? {
            amount: fromCents(toCents(row.amount)),
            currencyCode: row.currency_code,
            id: String(row.payment_id),
            paymentDate: row.payment_date,
            paymentStatus: row.payment_status,
            subscriptionId: String(row.subscription_id),
            userId: String(row.user_id),
          }
        : null;
    },

    async listPayments({
      client = database,
      limit = 10,
      offset = 0,
      sortBy = 'paymentDate',
      sortOrder = 'desc',
      ...filters
    }) {
      const { parameters, where } = buildFilters(filters);
      const sortColumn = sortColumnMap[sortBy] || 'p.payment_date';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      parameters.push(limit, offset);

      const result = await client.query(
        `
          ${detailedSelect}
          WHERE ${where}
          ORDER BY ${sortColumn} ${order}, p.payment_id DESC
          LIMIT $${parameters.length - 1} OFFSET $${parameters.length}
        `,
        parameters,
      );
      return result.rows.map(mapPayment);
    },

    async countPayments({ client = database, ...filters }) {
      const { parameters, where } = buildFilters(filters);
      const result = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM payment_history p
          JOIN subscription s ON s.subscription_id = p.subscription_id
          WHERE ${where}
        `,
        parameters,
      );
      return result.rows[0].total;
    },

    async updatePayment({ client = database, id, updates }) {
      const setClauses = [];
      const parameters = [];
      const set = (column, value) => {
        parameters.push(value);
        setClauses.push(`${column} = $${parameters.length}`);
      };

      if (updates.amount !== undefined) set('amount', updates.amount);
      if (updates.paymentStatus !== undefined) set('payment_status', updates.paymentStatus);
      if (updates.paymentDate !== undefined) set('payment_date', updates.paymentDate);
      if (updates.billingPeriodStart !== undefined) {
        set('billing_period_start', updates.billingPeriodStart || null);
      }
      if (updates.billingPeriodEnd !== undefined) {
        set('billing_period_end', updates.billingPeriodEnd || null);
      }
      if (updates.notes !== undefined) set('notes', updates.notes || null);
      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      parameters.push(id);
      const result = await client.query(
        `
          UPDATE payment_history
          SET ${setClauses.join(', ')}
          WHERE payment_id = $${parameters.length}
          RETURNING ${paymentColumns}
        `,
        parameters,
      );
      return mapPayment(result.rows[0]);
    },
  };
}
