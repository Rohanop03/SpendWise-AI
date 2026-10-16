// Analytics read model.
//   * Completed-payment totals come from the monthly_spend_by_category view (cash basis,
//     SUBSCRIPTION + CATEGORY + USERS join). Date filters are whole calendar months; the
//     service normalises startDate/endDate to month boundaries before calling these.
//   * Recurring estimates come from active_subscription_commitments, which applies the single
//     yearly -> monthly normalisation (spendwise_monthly_equivalent).
//   * Pending/failed payments and refunds are not in the view and are read from their tables.

export function createAnalyticsRepository(database) {
  return {
    async getFinancialOverview({ client = database, currencyCode, endDate, startDate, userId }) {
      const filters = [userId, startDate || null, endDate || null, currencyCode || null];
      const [completedResult, otherStatusResult, refundsResult, recurringResult] = await Promise.all([
        client.query(
          `
            SELECT currency_code,
                   SUM(total_amount) AS gross_payments,
                   SUM(payment_count)::int AS completed_payment_count
            FROM monthly_spend_by_category
            WHERE user_id = $1
              AND ($2::date IS NULL OR month >= $2)
              AND ($3::date IS NULL OR month <= $3)
              AND ($4::varchar IS NULL OR currency_code = $4)
            GROUP BY currency_code
          `,
          filters,
        ),
        client.query(
          `
            SELECT
              p.currency_code,
              COUNT(*) FILTER (WHERE p.payment_status = 'pending')::int AS pending_payment_count,
              COUNT(*) FILTER (WHERE p.payment_status IN ('failed', 'cancelled'))::int AS failed_payment_count,
              COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'pending'), 0) AS pending_amount,
              COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status IN ('failed', 'cancelled')), 0) AS failed_amount
            FROM payment_history p
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND p.payment_status <> 'completed'
              AND ($2::date IS NULL OR p.payment_date >= $2)
              AND ($3::date IS NULL OR p.payment_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.currency_code
          `,
          filters,
        ),
        client.query(
          `
            SELECT p.currency_code, COALESCE(SUM(r.amount), 0) AS completed_refunds,
                   COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payment_history p ON p.payment_id = r.payment_id
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.currency_code
          `,
          filters,
        ),
        client.query(
          `
            SELECT currency_code,
                   COUNT(*)::int AS active_subscription_count,
                   SUM(monthly_equivalent) AS estimated_monthly_recurring,
                   SUM(yearly_equivalent) AS estimated_yearly_recurring
            FROM active_subscription_commitments
            WHERE user_id = $1 AND ($2::varchar IS NULL OR currency_code = $2)
            GROUP BY currency_code
          `,
          [userId, currencyCode || null],
        ),
      ]);

      const payments = new Map();
      for (const row of completedResult.rows) payments.set(row.currency_code, { ...row });
      for (const row of otherStatusResult.rows) {
        payments.set(row.currency_code, { ...payments.get(row.currency_code), ...row });
      }

      return {
        payments: [...payments.values()],
        recurring: recurringResult.rows,
        refunds: refundsResult.rows,
      };
    },

    /** FR6 by month / year: the view's monthly totals, rolled up to years when asked. */
    async getSpendingTrends({
      client = database,
      currencyCode,
      endDate,
      interval = 'monthly',
      startDate,
      userId,
    }) {
      const isYearly = interval === 'yearly';
      const unit = isYearly ? 'year' : 'month';
      const label = isYearly ? 'YYYY' : 'YYYY-MM';
      const step = isYearly ? '1 year' : '1 month';

      const result = await client.query(
        `
          WITH payment_events AS (
            SELECT currency_code,
                   DATE_TRUNC('${unit}', month)::date AS period_date,
                   SUM(total_amount) AS gross_payments,
                   SUM(payment_count)::int AS completed_payment_count
            FROM monthly_spend_by_category
            WHERE user_id = $1
              AND ($2::date IS NULL OR month >= $2)
              AND ($3::date IS NULL OR month <= $3)
              AND ($4::varchar IS NULL OR currency_code = $4)
            GROUP BY currency_code, DATE_TRUNC('${unit}', month)
          ),
          refund_events AS (
            SELECT p.currency_code,
                   DATE_TRUNC('${unit}', r.refund_date)::date AS period_date,
                   SUM(r.amount) AS completed_refunds,
                   COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payment_history p ON p.payment_id = r.payment_id
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.currency_code, DATE_TRUNC('${unit}', r.refund_date)
          ),
          active_currencies AS (
            SELECT currency_code FROM payment_events
            UNION
            SELECT currency_code FROM refund_events
            UNION
            SELECT $4::varchar WHERE $4::varchar IS NOT NULL
          ),
          series_bounds AS (
            SELECT COALESCE($2::date, MIN(d), CURRENT_DATE) AS min_d,
                   COALESCE($3::date, MAX(d), CURRENT_DATE) AS max_d
            FROM (
              SELECT period_date AS d FROM payment_events
              UNION ALL
              SELECT period_date FROM refund_events
            ) bounds
          ),
          calendar_periods AS (
            SELECT g::date AS period_date
            FROM series_bounds sb,
                 LATERAL generate_series(DATE_TRUNC('${unit}', sb.min_d),
                                         DATE_TRUNC('${unit}', sb.max_d),
                                         INTERVAL '${step}') g
            WHERE sb.min_d <= sb.max_d
          )
          SELECT
            TO_CHAR(cp.period_date, '${label}') AS period,
            ac.currency_code,
            COALESCE(pe.gross_payments, 0) AS gross_payments,
            COALESCE(re.completed_refunds, 0) AS completed_refunds,
            COALESCE(pe.completed_payment_count, 0)::int AS completed_payment_count,
            COALESCE(re.refund_count, 0)::int AS refund_count
          FROM calendar_periods cp
          CROSS JOIN active_currencies ac
          LEFT JOIN payment_events pe
            ON pe.period_date = cp.period_date AND pe.currency_code = ac.currency_code
          LEFT JOIN refund_events re
            ON re.period_date = cp.period_date AND re.currency_code = ac.currency_code
          ORDER BY ac.currency_code, cp.period_date
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      return result.rows;
    },

    /**
     * FR6 by category: per-category totals from the view. `minAmount` keeps only categories
     * whose spend reaches the threshold (GROUP BY ... HAVING SUM(...) >= $6).
     */
    async getCategoryAnalytics({
      categoryId,
      client = database,
      currencyCode,
      endDate,
      minAmount,
      startDate,
      userId,
    }) {
      const result = await client.query(
        `
          WITH payment_cat AS (
            SELECT m.category_id, m.category_name, m.currency_code,
                   SUM(m.total_amount) AS gross_payments,
                   SUM(m.payment_count)::int AS completed_payment_count
            FROM monthly_spend_by_category m
            WHERE m.user_id = $1
              AND ($2::date IS NULL OR m.month >= $2)
              AND ($3::date IS NULL OR m.month <= $3)
              AND ($4::varchar IS NULL OR m.currency_code = $4)
              AND ($5::int IS NULL OR m.category_id = $5)
            GROUP BY m.category_id, m.category_name, m.currency_code
            HAVING SUM(m.total_amount) >= COALESCE($6::numeric, 0)
          ),
          refund_cat AS (
            SELECT s.category_id, p.currency_code,
                   SUM(r.amount) AS completed_refunds,
                   COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payment_history p ON p.payment_id = r.payment_id
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
              AND ($5::int IS NULL OR s.category_id = $5)
            GROUP BY s.category_id, p.currency_code
          ),
          combined AS (
            SELECT category_id, currency_code FROM payment_cat
            UNION
            SELECT category_id, currency_code FROM refund_cat WHERE $6::numeric IS NULL
          )
          SELECT
            c.category_id,
            c.category_name,
            comb.currency_code,
            COALESCE(pc.gross_payments, 0) AS gross_payments,
            COALESCE(rc.completed_refunds, 0) AS completed_refunds,
            COALESCE(pc.completed_payment_count, 0)::int AS completed_payment_count,
            COALESCE(rc.refund_count, 0)::int AS refund_count
          FROM combined comb
          JOIN category c ON c.category_id = comb.category_id
          LEFT JOIN payment_cat pc
            ON pc.category_id = comb.category_id AND pc.currency_code = comb.currency_code
          LEFT JOIN refund_cat rc
            ON rc.category_id = comb.category_id AND rc.currency_code = comb.currency_code
          ORDER BY comb.currency_code ASC, gross_payments DESC, c.category_name ASC
        `,
        [
          userId,
          startDate || null,
          endDate || null,
          currencyCode || null,
          categoryId ? Number(categoryId) : null,
          minAmount ?? null,
        ],
      );

      return result.rows;
    },

    async getSubscriptionAnalytics({
      client = database,
      currencyCode,
      endDate,
      limit = 20,
      offset = 0,
      sortBy = 'grossPayments',
      sortOrder = 'desc',
      startDate,
      subscriptionId,
      userId,
    }) {
      const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const sortMap = {
        completedPaymentCount: 'completed_payment_count',
        currentCost: 'current_cost',
        grossPayments: 'gross_payments',
        netCashFlow: 'net_cash_flow',
        serviceName: 'service_name',
      };
      const orderColumn = sortMap[sortBy] || 'gross_payments';

      const result = await client.query(
        `
          WITH payment_sub AS (
            SELECT p.subscription_id, SUM(p.amount) AS gross_payments,
                   COUNT(p.payment_id)::int AS completed_payment_count
            FROM payment_history p
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR p.payment_date >= $2)
              AND ($3::date IS NULL OR p.payment_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.subscription_id
          ),
          refund_sub AS (
            SELECT p.subscription_id, SUM(r.amount) AS completed_refunds,
                   COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payment_history p ON p.payment_id = r.payment_id
            JOIN subscription s ON s.subscription_id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.subscription_id
          ),
          aggregated AS (
            SELECT
              s.subscription_id,
              s.service_name,
              c.category_id,
              c.category_name,
              s.status,
              s.archived_at,
              s.billing_cycle,
              s.currency_code,
              s.cost AS current_cost,
              COALESCE(ps.gross_payments, 0) AS gross_payments,
              COALESCE(rs.completed_refunds, 0) AS completed_refunds,
              COALESCE(ps.gross_payments, 0) - COALESCE(rs.completed_refunds, 0) AS net_cash_flow,
              COALESCE(ps.completed_payment_count, 0)::int AS completed_payment_count,
              COALESCE(rs.refund_count, 0)::int AS refund_count,
              CASE WHEN s.archived_at IS NULL AND s.status = 'Active'
                   THEN spendwise_monthly_equivalent(s.cost, s.billing_cycle)
                   ELSE 0 END AS estimated_monthly_cost
            FROM subscription s
            JOIN category c ON c.category_id = s.category_id
            LEFT JOIN payment_sub ps ON ps.subscription_id = s.subscription_id
            LEFT JOIN refund_sub rs ON rs.subscription_id = s.subscription_id
            WHERE s.user_id = $1
              AND ($4::varchar IS NULL OR s.currency_code = $4)
              AND ($5::int IS NULL OR s.subscription_id = $5)
              AND (
                COALESCE(ps.completed_payment_count, 0) > 0
                OR COALESCE(rs.refund_count, 0) > 0
                OR ($2::date IS NULL AND $3::date IS NULL AND s.archived_at IS NULL)
              )
          )
          SELECT *, COUNT(*) OVER()::int AS total_count
          FROM aggregated
          ORDER BY ${orderColumn} ${orderDirection}, service_name ASC
          LIMIT $6 OFFSET $7
        `,
        [
          userId,
          startDate || null,
          endDate || null,
          currencyCode || null,
          subscriptionId ? Number(subscriptionId) : null,
          limit,
          offset,
        ],
      );

      return {
        rows: result.rows,
        totalCount: result.rows.length > 0 ? result.rows[0].total_count : 0,
      };
    },

    async getTopSubscriptions({
      client = database,
      currencyCode,
      endDate,
      limit = 5,
      startDate,
      type = 'recurring',
      userId,
    }) {
      if (type === 'recurring') {
        const result = await client.query(
          `
            SELECT a.subscription_id, a.service_name, c.category_name, a.status, a.billing_cycle,
                   a.currency_code, a.cost AS current_cost,
                   a.monthly_equivalent AS normalized_monthly_cost
            FROM active_subscription_commitments a
            JOIN category c ON c.category_id = a.category_id
            WHERE a.user_id = $1 AND ($2::varchar IS NULL OR a.currency_code = $2)
            ORDER BY a.monthly_equivalent DESC, a.cost DESC, a.subscription_id ASC
            LIMIT $3
          `,
          [userId, currencyCode || null, limit],
        );
        return result.rows;
      }

      const result = await client.query(
        `
          SELECT s.subscription_id, s.service_name, c.category_name, s.status, s.billing_cycle,
                 s.currency_code, s.cost AS current_cost,
                 SUM(p.amount) AS gross_payments,
                 COUNT(p.payment_id)::int AS completed_payment_count
          FROM payment_history p
          JOIN subscription s ON s.subscription_id = p.subscription_id
          JOIN category c ON c.category_id = s.category_id
          WHERE s.user_id = $1
            AND p.payment_status = 'completed'
            AND ($2::date IS NULL OR p.payment_date >= $2)
            AND ($3::date IS NULL OR p.payment_date <= ($3::date + INTERVAL '1 month - 1 day'))
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY s.subscription_id, c.category_name
          ORDER BY gross_payments DESC, completed_payment_count DESC, s.subscription_id ASC
          LIMIT $5
        `,
        [userId, startDate || null, endDate || null, currencyCode || null, limit],
      );
      return result.rows;
    },

    async getBillingCycleAnalytics({ client = database, currencyCode, userId }) {
      const result = await client.query(
        `
          SELECT billing_cycle, currency_code,
                 COUNT(*)::int AS subscription_count,
                 SUM(monthly_equivalent) AS estimated_monthly_total,
                 SUM(yearly_equivalent) AS estimated_yearly_total
          FROM active_subscription_commitments
          WHERE user_id = $1 AND ($2::varchar IS NULL OR currency_code = $2)
          GROUP BY billing_cycle, currency_code
          ORDER BY currency_code, billing_cycle
        `,
        [userId, currencyCode || null],
      );
      return result.rows;
    },

    async getPaymentStatusAnalytics({
      client = database,
      currencyCode,
      endDate,
      startDate,
      userId,
    }) {
      const result = await client.query(
        `
          SELECT p.currency_code, p.payment_status,
                 COUNT(p.payment_id)::int AS payment_count,
                 SUM(p.amount) AS total_amount
          FROM payment_history p
          JOIN subscription s ON s.subscription_id = p.subscription_id
          WHERE s.user_id = $1
            AND ($2::date IS NULL OR p.payment_date >= $2)
            AND ($3::date IS NULL OR p.payment_date <= ($3::date + INTERVAL '1 month - 1 day'))
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY p.currency_code, p.payment_status
          ORDER BY p.currency_code ASC, p.payment_status ASC
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );
      return result.rows;
    },

    async getRefundAnalytics({
      client = database,
      currencyCode,
      endDate,
      limit = 20,
      startDate,
      userId,
    }) {
      const filters = [userId, startDate || null, endDate || null, currencyCode || null];
      const [summaryResult, detailsResult] = await Promise.all([
        client.query(
          `
            WITH payment_refund_aggregates AS (
              SELECT p.payment_id, p.amount AS payment_amount, p.currency_code,
                     SUM(r.amount) AS total_refunded
              FROM payment_history p
              JOIN subscription s ON s.subscription_id = p.subscription_id
              JOIN refunds r ON r.payment_id = p.payment_id
              WHERE s.user_id = $1
                AND r.refund_status = 'completed'
                AND p.payment_status = 'completed'
                AND ($2::date IS NULL OR r.refund_date >= $2)
                AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
                AND ($4::varchar IS NULL OR p.currency_code = $4)
              GROUP BY p.payment_id, p.amount, p.currency_code
            )
            SELECT currency_code,
                   COUNT(*)::int AS refunded_payment_count,
                   COUNT(*) FILTER (WHERE total_refunded >= payment_amount)::int AS fully_refunded_count,
                   COUNT(*) FILTER (WHERE total_refunded < payment_amount)::int AS partially_refunded_count,
                   SUM(total_refunded) AS total_refund_amount
            FROM payment_refund_aggregates
            GROUP BY currency_code
            ORDER BY currency_code ASC
          `,
          filters,
        ),
        client.query(
          `
            SELECT r.id AS refund_id, r.payment_id, r.amount AS refund_amount,
                   r.refund_date::text AS refund_date, r.refund_status, r.reason,
                   p.currency_code, p.amount AS payment_amount, p.payment_date::text AS payment_date,
                   s.service_name, c.category_name
            FROM refunds r
            JOIN payment_history p ON p.payment_id = r.payment_id
            JOIN subscription s ON s.subscription_id = p.subscription_id
            JOIN category c ON c.category_id = s.category_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= ($3::date + INTERVAL '1 month - 1 day'))
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            ORDER BY r.refund_date DESC, r.id DESC
            LIMIT $5
          `,
          [...filters, limit],
        ),
      ]);

      return { recentRefunds: detailsResult.rows, summaries: summaryResult.rows };
    },
  };
}
