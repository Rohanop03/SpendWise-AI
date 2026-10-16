import { fromCents, toCents } from '../utils/money.js';

function mapRenewal(row, today) {
  const daysUntilRenewal = Number(row.days_until_renewal);
  return {
    billingCycle: row.billing_cycle,
    categoryId: String(row.category_id),
    categoryName: row.category_name,
    cost: fromCents(toCents(row.cost)),
    currencyCode: row.currency_code,
    daysUntilRenewal,
    isOverdue: row.renewal_date < today,
    monthlyEquivalent: fromCents(toCents(row.monthly_equivalent)),
    planName: row.plan_name ?? null,
    renewalDate: row.renewal_date,
    serviceName: row.service_name,
    status: row.status,
    subscriptionId: String(row.subscription_id),
  };
}

export function createBillingRepository(database) {
  return {
    async getTimezone(userId) {
      const result = await database.query(
        'SELECT timezone FROM user_preferences WHERE user_id = $1',
        [userId],
      );
      return result.rows[0]?.timezone ?? 'UTC';
    },

    /** FR7: the renewal_reminders_within function (no overdue rows). */
    async getUpcomingRenewals({ days, today, userId }) {
      const result = await database.query(
        `
          SELECT subscription_id, service_name, plan_name, category_id, category_name, cost,
                 currency_code, billing_cycle, status, renewal_date::text AS renewal_date,
                 days_until_renewal, monthly_equivalent
          FROM renewal_reminders_within($1, $2, $3::date)
        `,
        [userId, days, today],
      );
      return result.rows.map((row) => mapRenewal(row, today));
    },

    /** Active renewals whose date has already passed, reported separately from reminders. */
    async getOverdueRenewals({ today, userId }) {
      const result = await database.query(
        `
          SELECT s.subscription_id, s.service_name, s.plan_name, s.category_id, c.category_name,
                 s.cost, s.currency_code, s.billing_cycle, s.status,
                 s.renewal_date::text AS renewal_date,
                 s.renewal_date - $2::date AS days_until_renewal,
                 spendwise_monthly_equivalent(s.cost, s.billing_cycle) AS monthly_equivalent
          FROM subscription s
          JOIN category c ON c.category_id = s.category_id
          WHERE s.user_id = $1
            AND s.status = 'Active'
            AND s.archived_at IS NULL
            AND s.renewal_date < $2::date
          ORDER BY s.renewal_date, s.subscription_id
        `,
        [userId, today],
      );
      return result.rows.map((row) => mapRenewal(row, today));
    },

    /** Recurring commitments per currency from the active_subscription_commitments view. */
    async getRecurringCosts({ userId }) {
      const result = await database.query(
        `
          SELECT currency_code,
                 COUNT(*)::int AS subscription_count,
                 SUM(monthly_equivalent) AS monthly_equivalent,
                 SUM(yearly_equivalent) AS yearly_equivalent
          FROM active_subscription_commitments
          WHERE user_id = $1
          GROUP BY currency_code
          ORDER BY currency_code
        `,
        [userId],
      );
      return result.rows.map((row) => ({
        currencyCode: row.currency_code,
        monthlyEquivalent: fromCents(toCents(row.monthly_equivalent)),
        subscriptionCount: row.subscription_count,
        yearlyEquivalent: fromCents(toCents(row.yearly_equivalent)),
      }));
    },
  };
}
