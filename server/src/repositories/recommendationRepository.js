function mapRecommendation(row) {
  if (!row) return null;
  return {
    confidence: row.confidence,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    estimatedSavings: row.estimated_savings,
    evaluatedAt: row.evaluated_at,
    evidence: row.evidence,
    explanation: row.explanation,
    id: String(row.id),
    priority: row.priority,
    resolvedAt: row.resolved_at,
    ruleVersion: row.rule_version,
    savingsPeriod: row.savings_period,
    status: row.status,
    subscriptions: row.subscriptions || [],
    suggestedAction: row.suggested_action,
    title: row.title,
    type: row.recommendation_type,
    updatedAt: row.updated_at,
  };
}

const selectColumns = `
  r.id, r.recommendation_type, r.title, r.explanation, r.evidence, r.rule_version,
  r.estimated_savings, r.currency_code, r.savings_period, r.priority, r.confidence,
  r.suggested_action, r.status, r.resolved_at, r.evaluated_at, r.created_at, r.updated_at,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id::text, 'serviceName', COALESCE(svc.name, s.custom_service_name),
      'price', s.price, 'currencyCode', s.currency_code, 'billingCycle', s.billing_cycle,
      'status', s.status, 'relationshipRole', rs.relationship_role
    ) ORDER BY s.id)
    FROM recommendation_subscriptions rs
    JOIN subscriptions s ON s.id = rs.subscription_id AND s.user_id = rs.user_id
    LEFT JOIN services svc ON svc.id = s.service_id
    WHERE rs.recommendation_id = r.id
  ), '[]'::jsonb) AS subscriptions`;

export function createRecommendationRepository(database) {
  return {
    async getInputs(transaction, userId, periodStart, periodEnd) {
      await transaction.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const subscriptions = await transaction.query(
        `SELECT s.id::text, s.service_id::text, COALESCE(svc.name, s.custom_service_name) service_name,
                s.category_id::text, c.name category_name, s.price, s.currency_code,
                s.billing_cycle, s.status, s.next_renewal_date::text, s.trial_end_date::text,
                s.archived_at
         FROM subscriptions s
         JOIN categories c ON c.id = s.category_id
         LEFT JOIN services svc ON svc.id = s.service_id
         WHERE s.user_id = $1 ORDER BY s.id`,
        [userId],
      );
      const historical = await transaction.query(
        `WITH payment_totals AS (
           SELECT p.subscription_id, p.currency_code, count(*)::integer completed_payment_count,
                  sum(p.amount) gross_payments
           FROM payments p JOIN subscriptions s ON s.id = p.subscription_id
           WHERE s.user_id = $1 AND p.payment_status = 'completed'
             AND p.payment_date BETWEEN $2::date AND $3::date
           GROUP BY p.subscription_id, p.currency_code
         ), refund_totals AS (
           SELECT p.subscription_id, p.currency_code, COALESCE(sum(r.amount), 0) completed_refunds
           FROM refunds r JOIN payments p ON p.id = r.payment_id
           JOIN subscriptions s ON s.id = p.subscription_id
           WHERE s.user_id = $1 AND p.payment_status = 'completed' AND r.refund_status = 'completed'
             AND r.refund_date BETWEEN $2::date AND $3::date
           GROUP BY p.subscription_id, p.currency_code
         )
         SELECT pt.subscription_id::text, COALESCE(svc.name, s.custom_service_name) service_name,
                pt.currency_code, pt.completed_payment_count, pt.gross_payments,
                COALESCE(rt.completed_refunds, 0) completed_refunds,
                pt.gross_payments - COALESCE(rt.completed_refunds, 0) net_cash_flow,
                $2::date::text period_start
         FROM payment_totals pt JOIN subscriptions s ON s.id = pt.subscription_id
         LEFT JOIN services svc ON svc.id = s.service_id
         LEFT JOIN refund_totals rt ON rt.subscription_id = pt.subscription_id
           AND rt.currency_code = pt.currency_code`,
        [userId, periodStart, periodEnd],
      );
      return {
        historical: historical.rows.map((row) => ({
          completedPaymentCount: row.completed_payment_count,
          completedRefunds: row.completed_refunds,
          currencyCode: row.currency_code,
          grossPayments: row.gross_payments,
          netCashFlow: row.net_cash_flow,
          periodStart: row.period_start,
          serviceName: row.service_name,
          subscriptionId: row.subscription_id,
        })),
        subscriptions: subscriptions.rows.map((row) => ({
          archivedAt: row.archived_at,
          billingCycle: row.billing_cycle,
          categoryId: row.category_id,
          categoryName: row.category_name,
          currencyCode: row.currency_code,
          id: row.id,
          nextRenewalDate: row.next_renewal_date,
          price: row.price,
          serviceId: row.service_id,
          serviceName: row.service_name,
          status: row.status,
          trialEndDate: row.trial_end_date,
        })),
      };
    },

    async persist(transaction, userId, candidates, evaluatedAt) {
      const activeKeys = [];
      for (const candidate of candidates) {
        activeKeys.push(candidate.key);
        const result = await transaction.query(
          `INSERT INTO recommendations (
             user_id, recommendation_type, title, explanation, evidence, rule_version,
             estimated_savings, currency_code, savings_period, priority, confidence,
             suggested_action, recommendation_key, source_fingerprint, evaluated_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (user_id, recommendation_key) DO UPDATE SET
             recommendation_type = EXCLUDED.recommendation_type, title = EXCLUDED.title,
             explanation = EXCLUDED.explanation, evidence = EXCLUDED.evidence,
             rule_version = EXCLUDED.rule_version, estimated_savings = EXCLUDED.estimated_savings,
             currency_code = EXCLUDED.currency_code, savings_period = EXCLUDED.savings_period,
             priority = EXCLUDED.priority, confidence = EXCLUDED.confidence,
             suggested_action = EXCLUDED.suggested_action,
             source_fingerprint = EXCLUDED.source_fingerprint, evaluated_at = EXCLUDED.evaluated_at,
             status = CASE WHEN recommendations.status = 'inactive' THEN 'active' ELSE recommendations.status END,
             resolved_at = CASE WHEN recommendations.status = 'inactive' THEN NULL ELSE recommendations.resolved_at END,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [
            userId,
            candidate.type,
            candidate.title,
            candidate.explanation,
            JSON.stringify(candidate.evidence),
            candidate.ruleVersion,
            candidate.estimatedSavings,
            candidate.currencyCode,
            candidate.savingsPeriod,
            candidate.priority,
            candidate.confidence,
            candidate.suggestedAction,
            candidate.key,
            candidate.sourceFingerprint,
            evaluatedAt,
          ],
        );
        const recommendationId = result.rows[0].id;
        await transaction.query(
          'DELETE FROM recommendation_subscriptions WHERE recommendation_id = $1',
          [recommendationId],
        );
        for (const relation of candidate.subscriptions) {
          await transaction.query(
            `INSERT INTO recommendation_subscriptions (recommendation_id, subscription_id, user_id, relationship_role)
             VALUES ($1, $2, $3, $4)`,
            [recommendationId, relation.id, userId, relation.role],
          );
        }
      }
      await transaction.query(
        'CALL spendwise_retire_stale_recommendations($1, $2, $3::varchar[], $4, $5)',
        [userId, 'stage10-v1', activeKeys, evaluatedAt, 0],
      );
    },

    async list({ currencyCode, limit, offset, priority, sortBy, sortOrder, status, type, userId }) {
      const conditions = ['r.user_id = $1'];
      const values = [userId];
      for (const [column, value] of [
        ['r.status', status],
        ['r.recommendation_type', type],
        ['r.priority', priority],
        ['r.currency_code', currencyCode],
      ]) {
        if (value) {
          values.push(value);
          conditions.push(`${column} = $${values.length}`);
        }
      }
      const sortColumns = {
        createdAt: 'r.created_at',
        priority: "CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
        evaluatedAt: 'r.evaluated_at',
      };
      values.push(limit, offset);
      const result = await database.query(
        `SELECT ${selectColumns}, count(*) OVER()::integer total_count
         FROM recommendations r WHERE ${conditions.join(' AND ')}
         ORDER BY ${sortColumns[sortBy]} ${sortOrder}, r.id DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return { items: result.rows.map(mapRecommendation), total: result.rows[0]?.total_count || 0 };
    },

    async findById(userId, id) {
      const result = await database.query(
        `SELECT ${selectColumns} FROM recommendations r WHERE r.user_id = $1 AND r.id = $2`,
        [userId, id],
      );
      return mapRecommendation(result.rows[0]);
    },

    async updateStatus(userId, id, status, resolvedAt) {
      const result = await database.query(
        `UPDATE recommendations SET status = $3, resolved_at = $4, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND id = $2
         RETURNING id`,
        [userId, id, status, status === 'active' ? null : resolvedAt],
      );
      return result.rowCount === 1;
    },
  };
}
