function mapRecommendation(row) {
  if (!row) return null;
  return {
    currencyCode: row.currency_code,
    evaluatedAt: row.evaluated_at,
    generatedDate: row.generated_date,
    id: String(row.recommendation_id),
    potentialSavings: row.potential_savings,
    priority: row.priority,
    recommendationText: row.recommendation_text,
    resolvedAt: row.resolved_at,
    rule: row.rule,
    status: row.status,
    subscription: row.subscription_id
      ? {
          billingCycle: row.billing_cycle,
          categoryName: row.category_name,
          cost: Number(row.cost),
          currencyCode: row.subscription_currency_code,
          id: String(row.subscription_id),
          lastUsedDate: row.last_used_date,
          serviceName: row.service_name,
          status: row.subscription_status,
        }
      : null,
    subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    suggestedAction: row.suggested_action,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

const selectRecommendation = `
  SELECT
    r.recommendation_id, r.rule, r.title, r.recommendation_text, r.potential_savings,
    r.currency_code, r.priority, r.suggested_action, r.status, r.resolved_at,
    r.generated_date, r.evaluated_at, r.updated_at, r.subscription_id,
    s.service_name, s.cost, s.currency_code AS subscription_currency_code, s.billing_cycle,
    s.status AS subscription_status, s.last_used_date::text AS last_used_date, c.category_name
  FROM recommendation r
  LEFT JOIN subscription s ON s.subscription_id = r.subscription_id
  LEFT JOIN category c ON c.category_id = s.category_id
`;

const sortColumns = {
  evaluatedAt: 'r.evaluated_at',
  generatedDate: 'r.generated_date',
  potentialSavings: 'r.potential_savings',
  priority: "CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
};

export function createRecommendationRepository(database) {
  return {
    /** Rules 1-3 run inside the generate_recommendations stored procedure. */
    async generate(transaction, userId) {
      await transaction.query('SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      const result = await transaction.query('CALL generate_recommendations($1)', [userId]);
      return {
        matchedCount: result.rows[0].p_matched_count,
        removedCount: result.rows[0].p_removed_count,
      };
    },

    async list({ currencyCode, limit, offset, priority, rule, sortBy, sortOrder, status, userId }) {
      const conditions = ['r.user_id = $1'];
      const values = [userId];
      for (const [column, value] of [
        ['r.status', status === 'all' ? undefined : status],
        ['r.rule', rule],
        ['r.priority', priority],
        ['r.currency_code', currencyCode],
      ]) {
        if (value) {
          values.push(value);
          conditions.push(`${column} = $${values.length}`);
        }
      }
      values.push(limit, offset);
      const result = await database.query(
        `
          SELECT q.*, count(*) OVER()::integer AS total_count
          FROM (${selectRecommendation} WHERE ${conditions.join(' AND ')}) q
          ORDER BY ${sortColumns[sortBy].replaceAll('r.', 'q.')} ${sortOrder}, q.recommendation_id DESC
          LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
      );
      return { items: result.rows.map(mapRecommendation), total: result.rows[0]?.total_count || 0 };
    },

    async findById(userId, id) {
      const result = await database.query(
        `${selectRecommendation} WHERE r.user_id = $1 AND r.recommendation_id = $2`,
        [userId, id],
      );
      return mapRecommendation(result.rows[0]);
    },

    /**
     * Pending recommendations per currency. Savings are counted once per subscription (the
     * largest across rules), because cancelling a subscription can only save its cost once.
     */
    async summary(userId) {
      const result = await database.query(
        `
          WITH pending AS (
            SELECT subscription_id, currency_code, priority, potential_savings
            FROM recommendation
            WHERE user_id = $1 AND status = 'Pending'
          ),
          per_subscription AS (
            SELECT currency_code, MAX(potential_savings) AS savings
            FROM pending
            WHERE currency_code IS NOT NULL
            GROUP BY subscription_id, currency_code
          )
          SELECT
            (SELECT COUNT(*)::int FROM pending) AS pending_count,
            (SELECT COUNT(*)::int FROM pending WHERE priority = 'high') AS high_priority_count,
            COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('currencyCode', currency_code, 'amount', total)
                                ORDER BY currency_code)
               FROM (SELECT currency_code, SUM(savings)::numeric(12, 2)::text AS total
                     FROM per_subscription GROUP BY currency_code) t),
              '[]'::jsonb
            ) AS savings
        `,
        [userId],
      );
      const row = result.rows[0];
      return {
        highPriorityCount: row.high_priority_count,
        pendingCount: row.pending_count,
        potentialMonthlySavings: row.savings,
      };
    },

    async updateStatus(userId, id, status) {
      const result = await database.query(
        `
          UPDATE recommendation
          SET status = $3::recommendation_status,
              resolved_at = CASE WHEN $3::recommendation_status = 'Pending' THEN NULL
                                 ELSE COALESCE(resolved_at, CURRENT_TIMESTAMP) END,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND recommendation_id = $2
        `,
        [userId, id, status],
      );
      return result.rowCount === 1;
    },
  };
}
