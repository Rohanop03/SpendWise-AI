import { fromCents, toCents } from '../utils/money.js';

function mapBillingSubscription(row) {
  if (!row) {
    return null;
  }

  return {
    billingCycle: row.billing_cycle,
    categoryId: String(row.category_id),
    categoryName: row.category_name ?? null,
    currencyCode: row.currency_code,
    customServiceName: row.custom_service_name ?? null,
    id: String(row.id),
    nextRenewalDate: row.next_renewal_date ?? null,
    planName: row.plan_name ?? null,
    price: fromCents(toCents(row.price)),
    serviceId: row.service_id ? String(row.service_id) : null,
    serviceName: row.service_name ?? row.custom_service_name,
    startDate: row.start_date,
    status: row.status,
    trialEndDate: row.trial_end_date ?? null,
    userId: String(row.user_id),
  };
}

export function createBillingRepository(database) {
  return {
    async getActiveAndTrialSubscriptions({ client = database, userId }) {
      const result = await client.query(
        `
          SELECT
            s.id,
            s.user_id,
            s.service_id,
            s.custom_service_name,
            COALESCE(svc.name, s.custom_service_name) AS service_name,
            s.category_id,
            cat.name AS category_name,
            s.plan_name,
            s.price,
            s.currency_code,
            s.billing_cycle,
            s.status,
            s.start_date::text AS start_date,
            s.next_renewal_date::text AS next_renewal_date,
            s.trial_end_date::text AS trial_end_date
          FROM subscriptions s
          LEFT JOIN services svc ON svc.id = s.service_id
          JOIN categories cat ON cat.id = s.category_id
          WHERE s.user_id = $1
            AND s.archived_at IS NULL
            AND s.status IN ('active', 'trial')
          ORDER BY s.next_renewal_date ASC NULLS LAST, s.id ASC
        `,
        [userId],
      );

      return result.rows.map(mapBillingSubscription);
    },
  };
}
