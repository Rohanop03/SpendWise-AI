export function createAnalyticsRepository(database) {
  return {
    /**
     * Financial Overview:
     * Returns gross completed payments, completed refunds, net cash flow,
     * payment counts, and active recurring estimates grouped by currency.
     */
    async getFinancialOverview({ client = database, currencyCode, endDate, startDate, userId }) {
      // 1. Payment summaries by currency for the period
      const paymentsResult = await client.query(
        `
          SELECT
            p.currency_code,
            COALESCE(SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END), 0) AS gross_payments,
            COUNT(CASE WHEN p.payment_status = 'completed' THEN 1 END)::int AS completed_payment_count,
            COUNT(CASE WHEN p.payment_status = 'pending' THEN 1 END)::int AS pending_payment_count,
            COUNT(CASE WHEN p.payment_status IN ('failed', 'cancelled') THEN 1 END)::int AS failed_payment_count,
            COALESCE(SUM(CASE WHEN p.payment_status = 'pending' THEN p.amount ELSE 0 END), 0) AS pending_amount,
            COALESCE(SUM(CASE WHEN p.payment_status IN ('failed', 'cancelled') THEN p.amount ELSE 0 END), 0) AS failed_amount
          FROM payments p
          JOIN subscriptions s ON s.id = p.subscription_id
          WHERE s.user_id = $1
            AND ($2::date IS NULL OR p.payment_date >= $2)
            AND ($3::date IS NULL OR p.payment_date <= $3)
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY p.currency_code
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      // 2. Refund summaries by currency for the period (attributed on refund_date)
      const refundsResult = await client.query(
        `
          SELECT
            p.currency_code,
            COALESCE(SUM(r.amount), 0) AS completed_refunds,
            COUNT(r.id)::int AS refund_count
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN subscriptions s ON s.id = p.subscription_id
          WHERE s.user_id = $1
            AND r.refund_status = 'completed'
            AND p.payment_status = 'completed'
            AND ($2::date IS NULL OR r.refund_date >= $2)
            AND ($3::date IS NULL OR r.refund_date <= $3)
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY p.currency_code
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      // 3. Current active/trial subscription recurring estimates by currency
      const recurringResult = await client.query(
        `
          SELECT
            s.currency_code,
            COUNT(s.id)::int AS active_subscription_count,
            COALESCE(SUM(
              CASE s.billing_cycle
                WHEN 'monthly' THEN s.price
                WHEN 'quarterly' THEN ROUND(s.price / 3.0, 2)
                WHEN 'yearly' THEN ROUND(s.price / 12.0, 2)
                ELSE 0
              END
            ), 0) AS estimated_monthly_recurring,
            COALESCE(SUM(
              CASE s.billing_cycle
                WHEN 'monthly' THEN s.price * 12.0
                WHEN 'quarterly' THEN s.price * 4.0
                WHEN 'yearly' THEN s.price
                ELSE 0
              END
            ), 0) AS estimated_yearly_recurring
          FROM subscriptions s
          WHERE s.user_id = $1
            AND s.archived_at IS NULL
            AND s.status IN ('active', 'trial')
            AND ($2::varchar IS NULL OR s.currency_code = $2)
          GROUP BY s.currency_code
        `,
        [userId, currencyCode || null],
      );

      return {
        payments: paymentsResult.rows,
        recurring: recurringResult.rows,
        refunds: refundsResult.rows,
      };
    },

    /**
     * Monthly / Yearly Spending Trends:
     * Aggregates completed payments and completed refunds into calendar periods.
     * Generates a complete series of months when date range and currency are specified.
     */
    async getSpendingTrends({
      client = database,
      currencyCode,
      endDate,
      interval = 'monthly',
      startDate,
      userId,
    }) {
      const isYearly = interval === 'yearly';
      const truncFormat = isYearly ? 'year' : 'month';
      const toCharFormat = isYearly ? 'YYYY' : 'YYYY-MM';

      const result = await client.query(
        `
          WITH payment_events AS (
            SELECT
              p.currency_code,
              TO_CHAR(DATE_TRUNC('${truncFormat}', p.payment_date), '${toCharFormat}') AS period,
              DATE_TRUNC('${truncFormat}', p.payment_date)::date AS period_date,
              COALESCE(SUM(p.amount), 0) AS gross_payments,
              COUNT(p.id)::int AS completed_payment_count
            FROM payments p
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR p.payment_date >= $2)
              AND ($3::date IS NULL OR p.payment_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.currency_code, DATE_TRUNC('${truncFormat}', p.payment_date)
          ),
          refund_events AS (
            SELECT
              p.currency_code,
              TO_CHAR(DATE_TRUNC('${truncFormat}', r.refund_date), '${toCharFormat}') AS period,
              DATE_TRUNC('${truncFormat}', r.refund_date)::date AS period_date,
              COALESCE(SUM(r.amount), 0) AS completed_refunds,
              COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payments p ON p.id = r.payment_id
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.currency_code, DATE_TRUNC('${truncFormat}', r.refund_date)
          ),
          active_currencies AS (
            SELECT DISTINCT currency_code FROM (
              SELECT currency_code FROM payment_events
              UNION
              SELECT currency_code FROM refund_events
              UNION
              SELECT $4::varchar AS currency_code WHERE $4::varchar IS NOT NULL
            ) c WHERE currency_code IS NOT NULL
          ),
          series_bounds AS (
            SELECT
              COALESCE($2::date, MIN(sub.d), CURRENT_DATE) AS min_d,
              COALESCE($3::date, MAX(sub.d), CURRENT_DATE) AS max_d
            FROM (
              SELECT period_date AS d FROM payment_events
              UNION ALL
              SELECT period_date AS d FROM refund_events
            ) sub
          ),
          calendar_periods AS (
            SELECT
              TO_CHAR(s, '${toCharFormat}') AS period,
              s::date AS period_date
            FROM series_bounds sb,
            LATERAL generate_series(
              DATE_TRUNC('${truncFormat}', sb.min_d),
              DATE_TRUNC('${truncFormat}', sb.max_d),
              '${isYearly ? '1 year' : '1 month'}'::interval
            ) s
            WHERE sb.min_d <= sb.max_d
          ),
          matrix AS (
            SELECT
              cp.period,
              cp.period_date,
              ac.currency_code
            FROM calendar_periods cp
            CROSS JOIN active_currencies ac
          )
          SELECT
            m.period,
            m.currency_code,
            COALESCE(pe.gross_payments, 0) AS gross_payments,
            COALESCE(re.completed_refunds, 0) AS completed_refunds,
            (COALESCE(pe.gross_payments, 0) - COALESCE(re.completed_refunds, 0)) AS net_cash_flow,
            COALESCE(pe.completed_payment_count, 0)::int AS completed_payment_count,
            COALESCE(re.refund_count, 0)::int AS refund_count
          FROM matrix m
          LEFT JOIN payment_events pe
            ON pe.period = m.period AND pe.currency_code = m.currency_code
          LEFT JOIN refund_events re
            ON re.period = m.period AND re.currency_code = m.currency_code
          ORDER BY m.currency_code ASC, m.period ASC
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      return result.rows;
    },

    /**
     * Category-Wise Expense Analysis:
     * Aggregates completed payments and refunds by category and currency.
     * Uses CTEs to prevent 1-to-many join duplication.
     */
    async getCategoryAnalytics({
      categoryId,
      client = database,
      currencyCode,
      endDate,
      startDate,
      userId,
    }) {
      const result = await client.query(
        `
          WITH payment_cat AS (
            SELECT
              s.category_id,
              p.currency_code,
              COALESCE(SUM(p.amount), 0) AS gross_payments,
              COUNT(p.id)::int AS completed_payment_count
            FROM payments p
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR p.payment_date >= $2)
              AND ($3::date IS NULL OR p.payment_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
              AND ($5::bigint IS NULL OR s.category_id = $5)
            GROUP BY s.category_id, p.currency_code
          ),
          refund_cat AS (
            SELECT
              s.category_id,
              p.currency_code,
              COALESCE(SUM(r.amount), 0) AS completed_refunds,
              COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payments p ON p.id = r.payment_id
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
              AND ($5::bigint IS NULL OR s.category_id = $5)
            GROUP BY s.category_id, p.currency_code
          ),
          combined AS (
            SELECT category_id, currency_code FROM payment_cat
            UNION
            SELECT category_id, currency_code FROM refund_cat
          )
          SELECT
            c.id AS category_id,
            c.name AS category_name,
            comb.currency_code,
            COALESCE(pc.gross_payments, 0) AS gross_payments,
            COALESCE(rc.completed_refunds, 0) AS completed_refunds,
            (COALESCE(pc.gross_payments, 0) - COALESCE(rc.completed_refunds, 0)) AS net_cash_flow,
            COALESCE(pc.completed_payment_count, 0)::int AS completed_payment_count,
            COALESCE(rc.refund_count, 0)::int AS refund_count
          FROM combined comb
          JOIN categories c ON c.id = comb.category_id
          LEFT JOIN payment_cat pc
            ON pc.category_id = comb.category_id AND pc.currency_code = comb.currency_code
          LEFT JOIN refund_cat rc
            ON rc.category_id = comb.category_id AND rc.currency_code = comb.currency_code
          ORDER BY comb.currency_code ASC, gross_payments DESC, c.name ASC
        `,
        [
          userId,
          startDate || null,
          endDate || null,
          currencyCode || null,
          categoryId ? Number(categoryId) : null,
        ],
      );

      return result.rows;
    },

    /**
     * Subscription-Wise Spending Analysis:
     * Returns spending breakdown per subscription, including archived subscriptions.
     */
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
        currentPrice: 's.price',
        grossPayments: 'gross_payments',
        netCashFlow: 'net_cash_flow',
        serviceName: 'service_name',
      };
      const orderColumn = sortMap[sortBy] || 'gross_payments';

      const result = await client.query(
        `
          WITH payment_sub AS (
            SELECT
              p.subscription_id,
              COALESCE(SUM(p.amount), 0) AS gross_payments,
              COUNT(p.id)::int AS completed_payment_count
            FROM payments p
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR p.payment_date >= $2)
              AND ($3::date IS NULL OR p.payment_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.subscription_id
          ),
          refund_sub AS (
            SELECT
              p.subscription_id,
              COALESCE(SUM(r.amount), 0) AS completed_refunds,
              COUNT(r.id)::int AS refund_count
            FROM refunds r
            JOIN payments p ON p.id = r.payment_id
            JOIN subscriptions s ON s.id = p.subscription_id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.subscription_id
          ),
          aggregated AS (
            SELECT
              s.id AS subscription_id,
              s.user_id,
              COALESCE(svc.name, s.custom_service_name) AS service_name,
              cat.id AS category_id,
              cat.name AS category_name,
              s.status,
              s.archived_at,
              s.billing_cycle,
              s.currency_code,
              s.price AS current_price,
              COALESCE(ps.gross_payments, 0) AS gross_payments,
              COALESCE(rs.completed_refunds, 0) AS completed_refunds,
              (COALESCE(ps.gross_payments, 0) - COALESCE(rs.completed_refunds, 0)) AS net_cash_flow,
              COALESCE(ps.completed_payment_count, 0)::int AS completed_payment_count,
              COALESCE(rs.refund_count, 0)::int AS refund_count,
              CASE
                WHEN s.archived_at IS NULL AND s.status IN ('active', 'trial') THEN
                  CASE s.billing_cycle
                    WHEN 'monthly' THEN s.price
                    WHEN 'quarterly' THEN ROUND(s.price / 3.0, 2)
                    WHEN 'yearly' THEN ROUND(s.price / 12.0, 2)
                    ELSE 0
                  END
                ELSE 0
              END AS estimated_monthly_cost
            FROM subscriptions s
            LEFT JOIN services svc ON svc.id = s.service_id
            JOIN categories cat ON cat.id = s.category_id
            LEFT JOIN payment_sub ps ON ps.subscription_id = s.id
            LEFT JOIN refund_sub rs ON rs.subscription_id = s.id
            WHERE s.user_id = $1
              AND ($4::varchar IS NULL OR s.currency_code = $4)
              AND ($5::bigint IS NULL OR s.id = $5)
              AND (
                COALESCE(ps.completed_payment_count, 0) > 0
                OR COALESCE(rs.refund_count, 0) > 0
                OR ($2::date IS NULL AND $3::date IS NULL AND s.archived_at IS NULL)
              )
          )
          SELECT
            *,
            COUNT(*) OVER()::int AS total_count
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

    /**
     * Top Expensive Subscriptions:
     * Supports type = 'recurring' (normalized monthly cost) or 'historical' (gross payments).
     */
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
            SELECT
              s.id AS subscription_id,
              COALESCE(svc.name, s.custom_service_name) AS service_name,
              cat.name AS category_name,
              s.status,
              s.billing_cycle,
              s.currency_code,
              s.price AS current_price,
              ROUND(
                CASE s.billing_cycle
                  WHEN 'monthly' THEN s.price
                  WHEN 'quarterly' THEN s.price / 3.0
                  WHEN 'yearly' THEN s.price / 12.0
                  ELSE 0
                END, 2
              ) AS normalized_monthly_cost
            FROM subscriptions s
            LEFT JOIN services svc ON svc.id = s.service_id
            JOIN categories cat ON cat.id = s.category_id
            WHERE s.user_id = $1
              AND s.archived_at IS NULL
              AND s.status IN ('active', 'trial')
              AND ($2::varchar IS NULL OR s.currency_code = $2)
            ORDER BY normalized_monthly_cost DESC, s.price DESC, s.id ASC
            LIMIT $3
          `,
          [userId, currencyCode || null, limit],
        );

        return result.rows;
      }

      // type === 'historical'
      const result = await client.query(
        `
          SELECT
            s.id AS subscription_id,
            COALESCE(svc.name, s.custom_service_name) AS service_name,
            cat.name AS category_name,
            s.status,
            s.billing_cycle,
            s.currency_code,
            s.price AS current_price,
            COALESCE(SUM(p.amount), 0) AS gross_payments,
            COUNT(p.id)::int AS completed_payment_count
          FROM payments p
          JOIN subscriptions s ON s.id = p.subscription_id
          LEFT JOIN services svc ON svc.id = s.service_id
          JOIN categories cat ON cat.id = s.category_id
          WHERE s.user_id = $1
            AND p.payment_status = 'completed'
            AND ($2::date IS NULL OR p.payment_date >= $2)
            AND ($3::date IS NULL OR p.payment_date <= $3)
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY s.id, svc.name, s.custom_service_name, cat.name, s.status, s.billing_cycle, s.currency_code, s.price
          ORDER BY gross_payments DESC, completed_payment_count DESC, s.id ASC
          LIMIT $5
        `,
        [userId, startDate || null, endDate || null, currencyCode || null, limit],
      );

      return result.rows;
    },

    /**
     * Billing Cycle Distribution:
     * Groups active/trial subscriptions by billing cycle.
     */
    async getBillingCycleAnalytics({ client = database, currencyCode, userId }) {
      const result = await client.query(
        `
          SELECT
            s.billing_cycle,
            s.currency_code,
            COUNT(s.id)::int AS subscription_count,
            COUNT(CASE WHEN s.status = 'active' THEN 1 END)::int AS active_count,
            COUNT(CASE WHEN s.status = 'trial' THEN 1 END)::int AS trial_count,
            COALESCE(SUM(
              CASE s.billing_cycle
                WHEN 'monthly' THEN s.price
                WHEN 'quarterly' THEN ROUND(s.price / 3.0, 2)
                WHEN 'yearly' THEN ROUND(s.price / 12.0, 2)
                ELSE 0
              END
            ), 0) AS estimated_monthly_total,
            COALESCE(SUM(
              CASE s.billing_cycle
                WHEN 'monthly' THEN s.price * 12.0
                WHEN 'quarterly' THEN s.price * 4.0
                WHEN 'yearly' THEN s.price
                ELSE 0
              END
            ), 0) AS estimated_yearly_total
          FROM subscriptions s
          WHERE s.user_id = $1
            AND s.archived_at IS NULL
            AND s.status IN ('active', 'trial')
            AND ($2::varchar IS NULL OR s.currency_code = $2)
          GROUP BY s.billing_cycle, s.currency_code
          ORDER BY s.currency_code ASC,
            CASE s.billing_cycle
              WHEN 'monthly' THEN 1
              WHEN 'quarterly' THEN 2
              WHEN 'yearly' THEN 3
              ELSE 4
            END ASC
        `,
        [userId, currencyCode || null],
      );

      return result.rows;
    },

    /**
     * Payment Status Analytics:
     * Summarizes payment counts and amounts by status and currency.
     */
    async getPaymentStatusAnalytics({
      client = database,
      currencyCode,
      endDate,
      startDate,
      userId,
    }) {
      const result = await client.query(
        `
          SELECT
            p.currency_code,
            p.payment_status,
            COUNT(p.id)::int AS payment_count,
            COALESCE(SUM(p.amount), 0) AS total_amount
          FROM payments p
          JOIN subscriptions s ON s.id = p.subscription_id
          WHERE s.user_id = $1
            AND ($2::date IS NULL OR p.payment_date >= $2)
            AND ($3::date IS NULL OR p.payment_date <= $3)
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          GROUP BY p.currency_code, p.payment_status
          ORDER BY p.currency_code ASC, p.payment_status ASC
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      return result.rows;
    },

    /**
     * Refund Analytics:
     * Full vs partial refund counts, totals, and recent refund events.
     */
    async getRefundAnalytics({
      client = database,
      currencyCode,
      endDate,
      limit = 20,
      startDate,
      userId,
    }) {
      // 1. Aggregates: fully refunded vs partially refunded payments
      const summaryResult = await client.query(
        `
          WITH payment_refund_aggregates AS (
            SELECT
              p.id AS payment_id,
              p.amount AS payment_amount,
              p.currency_code,
              COALESCE(SUM(r.amount), 0) AS total_refunded
            FROM payments p
            JOIN subscriptions s ON s.id = p.subscription_id
            JOIN refunds r ON r.payment_id = p.id
            WHERE s.user_id = $1
              AND r.refund_status = 'completed'
              AND p.payment_status = 'completed'
              AND ($2::date IS NULL OR r.refund_date >= $2)
              AND ($3::date IS NULL OR r.refund_date <= $3)
              AND ($4::varchar IS NULL OR p.currency_code = $4)
            GROUP BY p.id, p.amount, p.currency_code
          )
          SELECT
            currency_code,
            COUNT(*)::int AS refunded_payment_count,
            COUNT(CASE WHEN total_refunded >= payment_amount THEN 1 END)::int AS fully_refunded_count,
            COUNT(CASE WHEN total_refunded < payment_amount THEN 1 END)::int AS partially_refunded_count,
            COALESCE(SUM(total_refunded), 0) AS total_refund_amount
          FROM payment_refund_aggregates
          GROUP BY currency_code
          ORDER BY currency_code ASC
        `,
        [userId, startDate || null, endDate || null, currencyCode || null],
      );

      // 2. Recent refund transactions
      const detailsResult = await client.query(
        `
          SELECT
            r.id AS refund_id,
            r.payment_id,
            r.amount AS refund_amount,
            r.refund_date::text AS refund_date,
            r.refund_status,
            r.reason,
            p.currency_code,
            p.amount AS payment_amount,
            p.payment_date::text AS payment_date,
            COALESCE(svc.name, s.custom_service_name) AS service_name,
            cat.name AS category_name
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN subscriptions s ON s.id = p.subscription_id
          LEFT JOIN services svc ON svc.id = s.service_id
          JOIN categories cat ON cat.id = s.category_id
          WHERE s.user_id = $1
            AND r.refund_status = 'completed'
            AND ($2::date IS NULL OR r.refund_date >= $2)
            AND ($3::date IS NULL OR r.refund_date <= $3)
            AND ($4::varchar IS NULL OR p.currency_code = $4)
          ORDER BY r.refund_date DESC, r.id DESC
          LIMIT $5
        `,
        [userId, startDate || null, endDate || null, currencyCode || null, limit],
      );

      return {
        recentRefunds: detailsResult.rows,
        summaries: summaryResult.rows,
      };
    },
  };
}
