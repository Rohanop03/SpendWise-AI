CREATE FUNCTION spendwise_monthly_equivalent(
  p_amount NUMERIC,
  p_billing_cycle TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
AS $$
BEGIN
  IF p_amount IS NULL OR p_billing_cycle IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'amount must be nonnegative'
      USING ERRCODE = '22023';
  END IF;

  IF p_billing_cycle NOT IN ('monthly', 'quarterly', 'yearly') THEN
    RAISE EXCEPTION 'unsupported billing cycle: %', p_billing_cycle
      USING ERRCODE = '22023';
  END IF;

  RETURN ROUND(
    CASE p_billing_cycle
      WHEN 'monthly' THEN p_amount
      WHEN 'quarterly' THEN p_amount / 3
      WHEN 'yearly' THEN p_amount / 12
    END,
    2
  );
END;
$$;

CREATE FUNCTION spendwise_user_financial_summary(
  p_user_id BIGINT,
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
SECURITY INVOKER
AS $$
  WITH payment_totals AS (
    SELECT
      p.currency_code,
      COUNT(*) AS completed_payment_count,
      SUM(p.amount) AS gross_payments
    FROM payments AS p
    INNER JOIN subscriptions AS s ON s.id = p.subscription_id
    WHERE s.user_id = p_user_id
      AND p.payment_status = 'completed'
      AND (p_start_date IS NULL OR p.payment_date >= p_start_date)
      AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    GROUP BY p.currency_code
  ),
  refund_totals AS (
    SELECT
      p.currency_code,
      SUM(r.amount) AS completed_refunds
    FROM refunds AS r
    INNER JOIN payments AS p ON p.id = r.payment_id
    INNER JOIN subscriptions AS s ON s.id = p.subscription_id
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
  ORDER BY currencies.currency_code;
$$;

CREATE PROCEDURE spendwise_retire_stale_recommendations(
  IN p_user_id BIGINT,
  IN p_rule_version VARCHAR(40),
  IN p_active_keys VARCHAR(200)[],
  IN p_evaluated_at TIMESTAMPTZ,
  INOUT p_retired_count INTEGER DEFAULT 0
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_rule_version IS NULL OR p_active_keys IS NULL OR p_evaluated_at IS NULL THEN
    RAISE EXCEPTION 'procedure arguments must not be null'
      USING ERRCODE = '22004';
  END IF;

  SELECT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'user does not exist'
      USING ERRCODE = '23503';
  END IF;

  UPDATE recommendations
  SET status = 'inactive',
      resolved_at = p_evaluated_at,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id
    AND rule_version = p_rule_version
    AND status = 'active'
    AND NOT (recommendation_key = ANY(p_active_keys));

  GET DIAGNOSTICS p_retired_count = ROW_COUNT;
EXCEPTION
  WHEN string_data_right_truncation THEN
    RAISE EXCEPTION 'rule version or recommendation key exceeds its permitted length'
      USING ERRCODE = '22001';
END;
$$;

CREATE TABLE subscription_audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  change_type VARCHAR(40) NOT NULL DEFAULT 'terms_changed',
  changed_fields TEXT[] NOT NULL,
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_audit_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscriptions (user_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_subscription_audit_change_type
    CHECK (change_type = 'terms_changed'),
  CONSTRAINT chk_subscription_audit_fields
    CHECK (cardinality(changed_fields) > 0),
  CONSTRAINT chk_subscription_audit_old_values
    CHECK (jsonb_typeof(old_values) = 'object'),
  CONSTRAINT chk_subscription_audit_new_values
    CHECK (jsonb_typeof(new_values) = 'object')
);

CREATE INDEX idx_subscription_audit_user_changed
  ON subscription_audit_events (user_id, changed_at DESC);
CREATE INDEX idx_subscription_audit_subscription_changed
  ON subscription_audit_events (subscription_id, changed_at DESC);

CREATE FUNCTION spendwise_audit_subscription_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_changed_fields TEXT[];
BEGIN
  v_changed_fields := array_remove(ARRAY[
    CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status' END,
    CASE WHEN OLD.price IS DISTINCT FROM NEW.price THEN 'price' END,
    CASE WHEN OLD.billing_cycle IS DISTINCT FROM NEW.billing_cycle THEN 'billing_cycle' END,
    CASE WHEN OLD.next_renewal_date IS DISTINCT FROM NEW.next_renewal_date THEN 'next_renewal_date' END
  ], NULL);

  IF cardinality(v_changed_fields) > 0 THEN
    INSERT INTO subscription_audit_events (
      subscription_id,
      user_id,
      changed_fields,
      old_values,
      new_values
    ) VALUES (
      NEW.id,
      NEW.user_id,
      v_changed_fields,
      jsonb_build_object(
        'status', OLD.status,
        'price', OLD.price,
        'billingCycle', OLD.billing_cycle,
        'nextRenewalDate', OLD.next_renewal_date
      ),
      jsonb_build_object(
        'status', NEW.status,
        'price', NEW.price,
        'billingCycle', NEW.billing_cycle,
        'nextRenewalDate', NEW.next_renewal_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscriptions_audit_terms
AFTER UPDATE OF status, price, billing_cycle, next_renewal_date
ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION spendwise_audit_subscription_changes();

CREATE VIEW active_subscription_commitments
WITH (security_invoker = true)
AS
SELECT
  s.user_id,
  s.id AS subscription_id,
  COALESCE(svc.name, s.custom_service_name) AS service_name,
  s.category_id,
  s.status,
  s.currency_code,
  s.billing_cycle,
  s.price,
  spendwise_monthly_equivalent(s.price, s.billing_cycle) AS monthly_equivalent,
  ROUND(spendwise_monthly_equivalent(s.price, s.billing_cycle) * 12, 2) AS yearly_equivalent,
  s.next_renewal_date
FROM subscriptions AS s
LEFT JOIN services AS svc ON svc.id = s.service_id
WHERE s.archived_at IS NULL
  AND s.status IN ('active', 'trial');

CREATE VIEW completed_payment_financials
WITH (security_invoker = true)
AS
WITH completed_refunds AS (
  SELECT
    r.payment_id,
    COUNT(*) AS refund_count,
    SUM(r.amount) AS completed_refunds
  FROM refunds AS r
  WHERE r.refund_status = 'completed'
  GROUP BY r.payment_id
)
SELECT
  s.user_id,
  p.id AS payment_id,
  p.subscription_id,
  COALESCE(svc.name, s.custom_service_name) AS service_name,
  p.currency_code,
  p.payment_date,
  p.amount AS gross_payment,
  COALESCE(completed_refunds.completed_refunds, 0) AS completed_refunds,
  p.amount - COALESCE(completed_refunds.completed_refunds, 0) AS net_cash_flow,
  COALESCE(completed_refunds.refund_count, 0) AS refund_count
FROM payments AS p
INNER JOIN subscriptions AS s ON s.id = p.subscription_id
LEFT JOIN services AS svc ON svc.id = s.service_id
LEFT JOIN completed_refunds ON completed_refunds.payment_id = p.id
WHERE p.payment_status = 'completed';

CREATE INDEX idx_payments_completed_subscription_covering
  ON payments (subscription_id, payment_date DESC, currency_code)
  INCLUDE (id, amount)
  WHERE payment_status = 'completed';

REVOKE ALL ON FUNCTION spendwise_monthly_equivalent(NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION spendwise_user_financial_summary(BIGINT, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION spendwise_audit_subscription_changes() FROM PUBLIC;
REVOKE ALL ON PROCEDURE spendwise_retire_stale_recommendations(BIGINT, VARCHAR, VARCHAR[], TIMESTAMPTZ, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION spendwise_monthly_equivalent(NUMERIC, TEXT) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION spendwise_user_financial_summary(BIGINT, DATE, DATE) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION spendwise_audit_subscription_changes() TO CURRENT_USER;
GRANT EXECUTE ON PROCEDURE spendwise_retire_stale_recommendations(BIGINT, VARCHAR, VARCHAR[], TIMESTAMPTZ, INTEGER) TO CURRENT_USER;
