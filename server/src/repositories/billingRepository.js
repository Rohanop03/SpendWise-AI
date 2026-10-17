import { fromCents, toCents } from '../utils/money.js';

function mapRenewal(row, today) {
  const daysUntilRenewal = Number(row.days_until_renewal);
  return {
    today,
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

// The user's local calendar date, computed in SQL so it costs no extra round trip.
const userToday = `(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(
  (SELECT timezone FROM user_preferences WHERE user_id = $1), 'UTC'))::date`;

export function createBillingRepository(database) {
  return {
    /** FR7: the renewal_reminders_within function (no overdue rows), from the user's today. */
    async getUpcomingRenewals({ days, userId }) {
      const result = await database.query(
        `
          SELECT r.subscription_id, r.service_name, r.plan_name, r.category_id, r.category_name,
                 r.cost, r.currency_code, r.billing_cycle, r.status,
                 r.renewal_date::text AS renewal_date, r.days_until_renewal, r.monthly_equivalent,
                 t.today::text AS today
          FROM (SELECT ${userToday} AS today) t
          CROSS JOIN LATERAL renewal_reminders_within($1, $2, t.today) r
        `,
        [userId, days],
      );
      return result.rows.map((row) => mapRenewal(row, row.today));
    },

    /** Active renewals whose date has already passed, reported separately from reminders. */
    async getOverdueRenewals({ userId }) {
      const result = await database.query(
        `
          SELECT s.subscription_id, s.service_name, s.plan_name, s.category_id, c.category_name,
                 s.cost, s.currency_code, s.billing_cycle, s.status,
                 s.renewal_date::text AS renewal_date,
                 s.renewal_date - t.today AS days_until_renewal,
                 spendwise_monthly_equivalent(s.cost, s.billing_cycle) AS monthly_equivalent,
                 t.today::text AS today
          FROM (SELECT ${userToday} AS today) t
          JOIN subscription s ON s.user_id = $1
          JOIN category c ON c.category_id = s.category_id
          WHERE s.status = 'Active'
            AND s.archived_at IS NULL
            AND s.renewal_date < t.today
          ORDER BY s.renewal_date, s.subscription_id
        `,
        [userId],
      );
      return result.rows.map((row) => mapRenewal(row, row.today));
    },

    async getToday(userId) {
      const result = await database.query(`SELECT ${userToday}::text AS today`, [userId]);
      return result.rows[0].today;
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
