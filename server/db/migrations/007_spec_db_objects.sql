-- 007: DBMS objects named in the Review 1 design document.
--   * trigger  trg_payment_history_update_renewal  (FR5)
--   * view     renewal_reminders                   (+ function renewal_reminders_within for FR7)
--   * view     monthly_spend_by_category           (FR6)
--   * procedure generate_recommendations(user_id)  (FR8/FR9, rules 1-3 in SQL)
--   * index    subscription(renewal_date)
-- plus the helper views/functions from 005, rebuilt for the renamed schema.

-- ---------------------------------------------------------------------------------------------
-- Yearly -> monthly normalisation: the single definition used by every query (D6).
-- LANGUAGE sql + IMMUTABLE so the planner inlines it.
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION spendwise_monthly_equivalent(NUMERIC, TEXT);

CREATE FUNCTION spendwise_monthly_equivalent(p_amount NUMERIC, p_billing_cycle billing_cycle_type)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ROUND(
    CASE p_billing_cycle
      WHEN 'Monthly' THEN p_amount
      WHEN 'Yearly' THEN p_amount / 12
    END,
    2
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- FR5: renewal date moves forward after every completed payment on an Active subscription.
-- ---------------------------------------------------------------------------------------------

-- The date p_periods billing cycles after p_from, on day p_anchor_day of the target month,
-- clamped to the month's last day (Jan 31 + 1 month = Feb 28/29). Anchoring on a day number
-- instead of adding the interval repeatedly stops month-end drift (Feb 28 -> Mar 31, not Mar 28).
CREATE FUNCTION spendwise_add_billing_periods(
  p_from DATE,
  p_billing_cycle billing_cycle_type,
  p_anchor_day INTEGER,
  p_periods INTEGER
)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (
    target_month
    + (LEAST(p_anchor_day, EXTRACT(DAY FROM target_month + INTERVAL '1 month - 1 day')::INTEGER) - 1)
      * INTERVAL '1 day'
  )::DATE
  FROM (
    SELECT date_trunc('month', p_from)
           + CASE p_billing_cycle
               WHEN 'Monthly' THEN p_periods * INTERVAL '1 month'
               ELSE p_periods * INTERVAL '1 year'
             END AS target_month
  ) AS t
$$;

CREATE FUNCTION spendwise_advance_renewal_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_subscription subscription%ROWTYPE;
  v_anchor_day INTEGER;
  v_periods INTEGER := 1;
  v_next DATE;
BEGIN
  IF NEW.payment_status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_subscription
  FROM subscription
  WHERE subscription_id = NEW.subscription_id
  FOR UPDATE;

  IF v_subscription.status <> 'Active' THEN
    RETURN NEW;
  END IF;

  -- Keep the original day of month once a renewal has been clamped to a shorter month.
  v_anchor_day := EXTRACT(DAY FROM v_subscription.renewal_date)::INTEGER;
  IF v_subscription.renewal_date
       = (date_trunc('month', v_subscription.renewal_date) + INTERVAL '1 month - 1 day')::DATE
     AND EXTRACT(DAY FROM v_subscription.start_date) > v_anchor_day THEN
    v_anchor_day := EXTRACT(DAY FROM v_subscription.start_date)::INTEGER;
  END IF;

  -- One cycle forward; a late payment keeps advancing until the date is after the payment.
  LOOP
    v_next := spendwise_add_billing_periods(
      v_subscription.renewal_date, v_subscription.billing_cycle, v_anchor_day, v_periods
    );
    EXIT WHEN v_next > NEW.payment_date;
    v_periods := v_periods + 1;
  END LOOP;

  UPDATE subscription
  SET renewal_date = v_next,
      updated_at = CURRENT_TIMESTAMP
  WHERE subscription_id = NEW.subscription_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_history_update_renewal
AFTER INSERT ON payment_history
FOR EACH ROW
EXECUTE FUNCTION spendwise_advance_renewal_date();

-- ---------------------------------------------------------------------------------------------
-- FR7: reminders. The view is the spec's fixed 7-day window; the function takes N days and
-- the caller's "today" (the user's local date). Both exclude overdue renewals.
-- ---------------------------------------------------------------------------------------------
CREATE VIEW renewal_reminders
WITH (security_invoker = true)
AS
SELECT
  s.subscription_id,
  s.user_id,
  u.name AS user_name,
  u.email,
  s.service_name,
  c.category_id,
  c.category_name,
  s.cost,
  s.currency_code,
  s.billing_cycle,
  s.renewal_date,
  s.renewal_date - CURRENT_DATE AS days_until_renewal
FROM subscription AS s
INNER JOIN category AS c ON c.category_id = s.category_id
INNER JOIN users AS u ON u.user_id = s.user_id
WHERE s.status = 'Active'
  AND s.archived_at IS NULL
  AND s.renewal_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7;

CREATE FUNCTION renewal_reminders_within(
  p_user_id INTEGER,
  p_days INTEGER,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  subscription_id INTEGER,
  user_id INTEGER,
  service_name VARCHAR(100),
  plan_name VARCHAR(120),
  category_id INTEGER,
  category_name VARCHAR(50),
  cost NUMERIC(8, 2),
  currency_code VARCHAR(3),
  billing_cycle billing_cycle_type,
  status subscription_status,
  start_date DATE,
  renewal_date DATE,
  days_until_renewal INTEGER,
  monthly_equivalent NUMERIC
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    s.subscription_id,
    s.user_id,
    s.service_name,
    s.plan_name,
    c.category_id,
    c.category_name,
    s.cost,
    s.currency_code,
    s.billing_cycle,
    s.status,
    s.start_date,
    s.renewal_date,
    s.renewal_date - p_today,
    spendwise_monthly_equivalent(s.cost, s.billing_cycle)
  FROM subscription AS s
  INNER JOIN category AS c ON c.category_id = s.category_id
  INNER JOIN users AS u ON u.user_id = s.user_id
  WHERE s.user_id = p_user_id
    AND s.status = 'Active'
    AND s.archived_at IS NULL
    AND s.renewal_date BETWEEN p_today AND p_today + p_days
  ORDER BY s.renewal_date, s.subscription_id
$$;

-- ---------------------------------------------------------------------------------------------
-- FR6: cash-basis spend per user, category, currency and calendar month (completed payments).
-- ---------------------------------------------------------------------------------------------
CREATE VIEW monthly_spend_by_category
WITH (security_invoker = true)
AS
SELECT
  s.user_id,
  u.name AS user_name,
  c.category_id,
  c.category_name,
  p.currency_code,
  date_trunc('month', p.payment_date)::DATE AS month,
  SUM(p.amount) AS total_amount,
  COUNT(*)::INTEGER AS payment_count
FROM payment_history AS p
INNER JOIN subscription AS s ON s.subscription_id = p.subscription_id
INNER JOIN category AS c ON c.category_id = s.category_id
INNER JOIN users AS u ON u.user_id = s.user_id
WHERE p.payment_status = 'completed'
GROUP BY s.user_id, u.name, c.category_id, c.category_name, p.currency_code,
         date_trunc('month', p.payment_date);

-- ---------------------------------------------------------------------------------------------
-- FR8/FR9: recommendation rules in SQL.
--   Rule 1 unused_subscription     last_used_date more than 60 days ago (NULL = not flagged)
--   Rule 2 above_category_average  monthly cost > average of all OTHER Active subscriptions in
--                                  the same category and currency, across all users
--                                  (correlated subquery)
--   Rule 3 duplicate_category      more than one Active subscription in a category
--                                  (GROUP BY ... HAVING COUNT(*) > 1); every subscription
--                                  except the most expensive one is a cancel candidate
-- Idempotent: upsert on (user_id, subscription_id, rule); Reviewed/Dismissed are never reset to
-- Pending; Pending rows whose rule no longer matches are deleted.
-- ---------------------------------------------------------------------------------------------
CREATE PROCEDURE generate_recommendations(
  IN p_user_id INTEGER,
  INOUT p_matched_count INTEGER DEFAULT NULL,
  INOUT p_removed_count INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_kept INTEGER[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id must not be null' USING ERRCODE = '22004';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'user does not exist' USING ERRCODE = '23503';
  END IF;

  WITH active_subscription AS (
    SELECT
      s.subscription_id,
      s.user_id,
      s.category_id,
      s.service_name,
      s.currency_code,
      s.last_used_date,
      spendwise_monthly_equivalent(s.cost, s.billing_cycle) AS monthly_cost
    FROM subscription AS s
    WHERE s.user_id = p_user_id
      AND s.status = 'Active'
      AND s.archived_at IS NULL
  ),
  rule_unused AS (
    SELECT
      unused.subscription_id,
      'unused_subscription'::VARCHAR(40) AS rule,
      'high'::VARCHAR(10) AS priority,
      'Unused subscription'::VARCHAR(160) AS title,
      format('Cancel %s — unused for %s days, would save %s %s/month',
             unused.service_name, unused.unused_days, unused.currency_code,
             to_char(unused.monthly_cost, 'FM99999990.00')) AS recommendation_text,
      unused.monthly_cost AS potential_savings,
      unused.currency_code,
      'Cancel it if you no longer use it.'::VARCHAR(500) AS suggested_action
    FROM (
      SELECT a.*, CURRENT_DATE - a.last_used_date AS unused_days
      FROM active_subscription AS a
      WHERE a.last_used_date IS NOT NULL
    ) AS unused
    WHERE unused.unused_days > 60
  ),
  rule_above_average AS (
    SELECT
      priced.subscription_id,
      'above_category_average'::VARCHAR(40),
      'medium'::VARCHAR(10),
      'Above category average'::VARCHAR(160),
      format('%s costs %s %s/month, %s %s above the %s average of %s %s/month',
             priced.service_name, priced.currency_code, to_char(priced.monthly_cost, 'FM99999990.00'),
             priced.currency_code, to_char(priced.monthly_cost - priced.category_average, 'FM99999990.00'),
             c.category_name, priced.currency_code, to_char(priced.category_average, 'FM99999990.00')),
      ROUND(priced.monthly_cost - priced.category_average, 2),
      priced.currency_code,
      'Look for a cheaper plan or provider in this category.'::VARCHAR(500)
    FROM (
      SELECT
        a.*,
        (
          SELECT ROUND(AVG(spendwise_monthly_equivalent(o.cost, o.billing_cycle)), 2)
          FROM subscription AS o
          WHERE o.category_id = a.category_id
            AND o.currency_code = a.currency_code
            AND o.status = 'Active'
            AND o.archived_at IS NULL
            AND o.subscription_id <> a.subscription_id
        ) AS category_average
      FROM active_subscription AS a
    ) AS priced
    INNER JOIN category AS c ON c.category_id = priced.category_id
    WHERE priced.category_average IS NOT NULL
      AND priced.monthly_cost > priced.category_average
  ),
  duplicate_group AS (
    SELECT a.user_id, a.category_id, COUNT(*) AS subscription_count
    FROM active_subscription AS a
    GROUP BY a.user_id, a.category_id
    HAVING COUNT(*) > 1
  ),
  rule_duplicate AS (
    SELECT
      ranked.subscription_id,
      'duplicate_category'::VARCHAR(40),
      'medium'::VARCHAR(10),
      'Duplicate category'::VARCHAR(160),
      format('You have %s active %s subscriptions; cancelling %s would save %s %s/month',
             ranked.subscription_count, ranked.category_name, ranked.service_name,
             ranked.currency_code, to_char(ranked.monthly_cost, 'FM99999990.00')),
      ranked.monthly_cost,
      ranked.currency_code,
      'Keep the one you use most and cancel the others.'::VARCHAR(500)
    FROM (
      SELECT
        a.*,
        g.subscription_count,
        c.category_name,
        row_number() OVER (
          PARTITION BY a.category_id
          ORDER BY a.monthly_cost DESC, a.subscription_id
        ) AS cost_rank
      FROM active_subscription AS a
      INNER JOIN duplicate_group AS g ON g.category_id = a.category_id
      INNER JOIN category AS c ON c.category_id = a.category_id
    ) AS ranked
    WHERE ranked.cost_rank > 1
  ),
  candidate AS (
    SELECT * FROM rule_unused
    UNION ALL
    SELECT * FROM rule_above_average
    UNION ALL
    SELECT * FROM rule_duplicate
  ),
  upserted AS (
    INSERT INTO recommendation (
      user_id, subscription_id, rule, priority, title, recommendation_text,
      potential_savings, currency_code, suggested_action, evaluated_at
    )
    SELECT
      p_user_id, candidate.subscription_id, candidate.rule, candidate.priority, candidate.title,
      left(candidate.recommendation_text, 255), candidate.potential_savings,
      candidate.currency_code, candidate.suggested_action, CURRENT_TIMESTAMP
    FROM candidate
    ON CONFLICT (user_id, subscription_id, rule) DO UPDATE
    SET recommendation_text = EXCLUDED.recommendation_text,
        potential_savings = EXCLUDED.potential_savings,
        currency_code = EXCLUDED.currency_code,
        priority = EXCLUDED.priority,
        title = EXCLUDED.title,
        suggested_action = EXCLUDED.suggested_action,
        evaluated_at = EXCLUDED.evaluated_at,
        updated_at = CASE
          WHEN recommendation.recommendation_text IS DISTINCT FROM EXCLUDED.recommendation_text
            OR recommendation.potential_savings IS DISTINCT FROM EXCLUDED.potential_savings
          THEN CURRENT_TIMESTAMP
          ELSE recommendation.updated_at
        END
    RETURNING recommendation_id
  )
  SELECT COALESCE(array_agg(recommendation_id), ARRAY[]::INTEGER[]) INTO v_kept FROM upserted;

  p_matched_count := cardinality(v_kept);

  DELETE FROM recommendation
  WHERE user_id = p_user_id
    AND status = 'Pending'
    AND NOT (recommendation_id = ANY (v_kept));

  GET DIAGNOSTICS p_removed_count = ROW_COUNT;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Indexes (D16)
-- ---------------------------------------------------------------------------------------------
-- Global "renews soon" scans (renewal_reminders view, reminder worker).
CREATE INDEX idx_subscription_renewal_date
  ON subscription (renewal_date)
  WHERE status = 'Active';

-- Rule 2's correlated subquery: other Active subscriptions in one category and currency,
-- answered from the index alone (subscription_id is needed for "excluding itself").
CREATE INDEX idx_subscription_category_currency_active
  ON subscription (category_id, currency_code)
  INCLUDE (cost, billing_cycle, subscription_id)
  WHERE status = 'Active' AND archived_at IS NULL;

-- ---------------------------------------------------------------------------------------------
-- 005 helpers rebuilt for the renamed schema (D17)
-- ---------------------------------------------------------------------------------------------
CREATE VIEW active_subscription_commitments
WITH (security_invoker = true)
AS
SELECT
  s.user_id,
  s.subscription_id,
  s.service_name,
  s.category_id,
  s.status,
  s.currency_code,
  s.billing_cycle,
  s.cost,
  spendwise_monthly_equivalent(s.cost, s.billing_cycle) AS monthly_equivalent,
  ROUND(spendwise_monthly_equivalent(s.cost, s.billing_cycle) * 12, 2) AS yearly_equivalent,
  s.renewal_date
FROM subscription AS s
WHERE s.archived_at IS NULL
  AND s.status = 'Active';

CREATE VIEW completed_payment_financials
WITH (security_invoker = true)
AS
WITH completed_refunds AS (
  SELECT r.payment_id, COUNT(*) AS refund_count, SUM(r.amount) AS completed_refunds
  FROM refunds AS r
  WHERE r.refund_status = 'completed'
  GROUP BY r.payment_id
)
SELECT
  s.user_id,
  p.payment_id,
  p.subscription_id,
  s.service_name,
  p.currency_code,
  p.payment_date,
  p.amount AS gross_payment,
  COALESCE(completed_refunds.completed_refunds, 0) AS completed_refunds,
  p.amount - COALESCE(completed_refunds.completed_refunds, 0) AS net_cash_flow,
  COALESCE(completed_refunds.refund_count, 0) AS refund_count
FROM payment_history AS p
INNER JOIN subscription AS s ON s.subscription_id = p.subscription_id
LEFT JOIN completed_refunds ON completed_refunds.payment_id = p.payment_id
WHERE p.payment_status = 'completed';

CREATE FUNCTION spendwise_user_financial_summary(
  p_user_id INTEGER,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  currency_code VARCHAR(3),
  completed_payment_count BIGINT,
  gross_payments NUMERIC,
  completed_refunds NUMERIC,
  net_cash_flow NUMERIC
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH payment_totals AS (
    SELECT p.currency_code, COUNT(*) AS completed_payment_count, SUM(p.amount) AS gross_payments
    FROM payment_history AS p
    INNER JOIN subscription AS s ON s.subscription_id = p.subscription_id
    WHERE s.user_id = p_user_id
      AND p.payment_status = 'completed'
      AND (p_start_date IS NULL OR p.payment_date >= p_start_date)
      AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    GROUP BY p.currency_code
  ),
  refund_totals AS (
    SELECT p.currency_code, SUM(r.amount) AS completed_refunds
    FROM refunds AS r
    INNER JOIN payment_history AS p ON p.payment_id = r.payment_id
    INNER JOIN subscription AS s ON s.subscription_id = p.subscription_id
    WHERE s.user_id = p_user_id
      AND p.payment_status = 'completed'
      AND r.refund_status = 'completed'
      AND (p_start_date IS NULL OR r.refund_date >= p_start_date)
      AND (p_end_date IS NULL OR r.refund_date <= p_end_date)
    GROUP BY p.currency_code
  ),
  currencies AS (
    SELECT payment_totals.currency_code FROM payment_totals
    UNION
    SELECT refund_totals.currency_code FROM refund_totals
  )
  SELECT
    currencies.currency_code,
    COALESCE(payment_totals.completed_payment_count, 0),
    COALESCE(payment_totals.gross_payments, 0),
    COALESCE(refund_totals.completed_refunds, 0),
    COALESCE(payment_totals.gross_payments, 0) - COALESCE(refund_totals.completed_refunds, 0)
  FROM currencies
  LEFT JOIN payment_totals USING (currency_code)
  LEFT JOIN refund_totals USING (currency_code)
  ORDER BY currencies.currency_code
$$;

REVOKE ALL ON FUNCTION spendwise_monthly_equivalent(NUMERIC, billing_cycle_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION spendwise_add_billing_periods(DATE, billing_cycle_type, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION spendwise_advance_renewal_date() FROM PUBLIC;
REVOKE ALL ON FUNCTION renewal_reminders_within(INTEGER, INTEGER, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION spendwise_user_financial_summary(INTEGER, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON PROCEDURE generate_recommendations(INTEGER, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION spendwise_monthly_equivalent(NUMERIC, billing_cycle_type) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION spendwise_add_billing_periods(DATE, billing_cycle_type, INTEGER, INTEGER) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION spendwise_advance_renewal_date() TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION renewal_reminders_within(INTEGER, INTEGER, DATE) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION spendwise_user_financial_summary(INTEGER, DATE, DATE) TO CURRENT_USER;
GRANT EXECUTE ON PROCEDURE generate_recommendations(INTEGER, INTEGER, INTEGER) TO CURRENT_USER;
