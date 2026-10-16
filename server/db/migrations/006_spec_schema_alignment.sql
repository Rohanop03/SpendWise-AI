-- 006: Align the physical schema with the Review 1 design document.
--
-- Spec name            -> physical name
--   USERS              -> users            (user_id, name, email, password_hash, created_at)
--   CATEGORY           -> category         (category_id, category_name)
--   SUBSCRIPTION       -> subscription     (subscription_id, user_id, category_id, service_name, cost,
--                                           billing_cycle, start_date, renewal_date, last_used_date, status)
--   PAYMENT_HISTORY    -> payment_history  (payment_id, subscription_id, amount, payment_date)
--   RECOMMENDATION     -> recommendation   (recommendation_id, user_id, subscription_id,
--                                           recommendation_text, potential_savings, generated_date, status)
--
-- Data-preserving: every precondition below stops the migration (with a row count) instead of
-- silently rewriting user data that the new constraints would reject.

-- ---------------------------------------------------------------------------------------------
-- 1. Preconditions
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM subscriptions WHERE billing_cycle = 'quarterly';
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % subscription(s) use the quarterly billing cycle; the spec allows only Monthly and Yearly. Convert them before migrating.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM subscriptions WHERE price <= 0;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % subscription(s) have a cost of 0; the spec requires Cost > 0.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM subscriptions WHERE price >= 1000000;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % subscription cost(s) do not fit DECIMAL(8,2).', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM payments WHERE amount >= 1000000;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % payment amount(s) do not fit DECIMAL(8,2).', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM subscriptions s LEFT JOIN services v ON v.id = s.service_id
  WHERE char_length(btrim(COALESCE(v.name, s.custom_service_name))) > 100;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % service name(s) exceed VARCHAR(100).', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM users WHERE char_length(email) > 150;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % email address(es) exceed VARCHAR(150).', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM categories WHERE char_length(btrim(name)) > 50;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % category name(s) exceed VARCHAR(50).', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM payments p JOIN subscriptions s ON s.id = p.subscription_id
  WHERE p.currency_code <> s.currency_code;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % payment(s) use a currency different from their subscription.', v_count;
  END IF;

  SELECT (SELECT count(*) FROM users WHERE id > 2147483647)
       + (SELECT count(*) FROM categories WHERE id > 2147483647)
       + (SELECT count(*) FROM subscriptions WHERE id > 2147483647)
       + (SELECT count(*) FROM payments WHERE id > 2147483647)
       + (SELECT count(*) FROM recommendations WHERE id > 2147483647)
  INTO v_count;
  IF v_count > 0 THEN
    RAISE EXCEPTION '006: % identifier(s) do not fit INT.', v_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Drop objects whose definitions depend on columns that change (recreated in 006/007)
-- ---------------------------------------------------------------------------------------------
DROP VIEW active_subscription_commitments;
DROP VIEW completed_payment_financials;
DROP TRIGGER trg_subscriptions_audit_terms ON subscriptions;
DROP FUNCTION spendwise_user_financial_summary(BIGINT, DATE, DATE);
-- Folded into generate_recommendations (migration 007).
DROP PROCEDURE spendwise_retire_stale_recommendations(BIGINT, VARCHAR, VARCHAR[], TIMESTAMPTZ, INTEGER);

-- Every foreign key is dropped and re-created below with the spec's delete policy.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. USERS
-- ---------------------------------------------------------------------------------------------
ALTER TABLE users RENAME COLUMN id TO user_id;
ALTER TABLE users RENAME COLUMN display_name TO name;
ALTER TABLE users RENAME CONSTRAINT chk_users_display_name TO chk_users_name;
ALTER TABLE users DROP CONSTRAINT chk_users_email;
ALTER TABLE users
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN email TYPE VARCHAR(150),
  ADD CONSTRAINT chk_users_email CHECK (
    email = btrim(email)
    AND char_length(email) <= 150
    AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  );

ALTER TABLE user_preferences
  ALTER COLUMN user_id TYPE INTEGER,
  -- Trials are no longer a subscription status, so trial reminders have no subject.
  DROP COLUMN trial_reminders_enabled,
  DROP COLUMN trial_reminder_days;
ALTER TABLE auth_sessions ALTER COLUMN user_id TYPE INTEGER;

-- ---------------------------------------------------------------------------------------------
-- 4. CATEGORY
-- ---------------------------------------------------------------------------------------------
ALTER TABLE categories RENAME TO category;
ALTER TABLE category RENAME COLUMN id TO category_id;
ALTER TABLE category RENAME COLUMN name TO category_name;
ALTER TABLE category DROP CONSTRAINT chk_categories_name;
ALTER TABLE category
  ALTER COLUMN category_id TYPE INTEGER,
  ALTER COLUMN category_name TYPE VARCHAR(50),
  ADD CONSTRAINT chk_category_name CHECK (char_length(btrim(category_name)) BETWEEN 1 AND 50);
ALTER TABLE category RENAME CONSTRAINT chk_categories_description TO chk_category_description;
ALTER INDEX uq_categories_name_ci RENAME TO uq_category_name_ci;
ALTER TABLE services ALTER COLUMN default_category_id TYPE INTEGER;

-- ---------------------------------------------------------------------------------------------
-- 5. SUBSCRIPTION
-- ---------------------------------------------------------------------------------------------
ALTER TABLE subscriptions RENAME TO subscription;
ALTER TABLE subscription RENAME COLUMN id TO subscription_id;
ALTER TABLE subscription RENAME COLUMN price TO cost;
ALTER TABLE subscription RENAME COLUMN next_renewal_date TO renewal_date;

ALTER TABLE subscription
  DROP CONSTRAINT chk_subscriptions_billing_cycle,
  DROP CONSTRAINT chk_subscriptions_status,
  DROP CONSTRAINT chk_subscriptions_next_renewal,
  DROP CONSTRAINT chk_subscriptions_trial_end,
  DROP CONSTRAINT chk_subscriptions_cancellation,
  DROP CONSTRAINT chk_subscriptions_price,
  DROP CONSTRAINT chk_subscriptions_service_source,
  ALTER COLUMN status DROP DEFAULT;
DROP INDEX idx_subscriptions_upcoming_renewal;
DROP INDEX idx_subscriptions_service;

-- Service_Name is stored directly (D13): the catalog FK + custom name pair made the displayed
-- name depend on services.name through service_id, a transitive dependency.
ALTER TABLE subscription ADD COLUMN service_name VARCHAR(100);
UPDATE subscription AS s
SET service_name = btrim(COALESCE(
  (SELECT v.name FROM services AS v WHERE v.id = s.service_id),
  s.custom_service_name
));
ALTER TABLE subscription
  DROP COLUMN service_id,
  DROP COLUMN custom_service_name,
  DROP COLUMN trial_end_date,
  ALTER COLUMN service_name SET NOT NULL,
  ADD CONSTRAINT chk_subscription_service_name
    CHECK (char_length(btrim(service_name)) BETWEEN 1 AND 100);

-- D2 value sets. trial/paused were "currently billable or about to be" -> Active.
CREATE TYPE billing_cycle_type AS ENUM ('Monthly', 'Yearly');
CREATE TYPE subscription_status AS ENUM ('Active', 'Cancelled');
CREATE TYPE recommendation_status AS ENUM ('Pending', 'Reviewed', 'Dismissed');

UPDATE subscription SET billing_cycle = CASE billing_cycle WHEN 'monthly' THEN 'Monthly' ELSE 'Yearly' END;
UPDATE subscription SET status = CASE WHEN status = 'cancelled' THEN 'Cancelled' ELSE 'Active' END;
-- D3: Renewal_Date is NOT NULL; a cancelled row without one keeps its cancellation date.
UPDATE subscription
SET renewal_date = GREATEST(start_date, COALESCE(cancelled_at::DATE, start_date))
WHERE renewal_date IS NULL;

ALTER TABLE subscription
  ALTER COLUMN subscription_id TYPE INTEGER,
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN category_id TYPE INTEGER,
  ALTER COLUMN cost TYPE NUMERIC(8, 2),
  ALTER COLUMN billing_cycle TYPE billing_cycle_type USING billing_cycle::billing_cycle_type,
  ALTER COLUMN status TYPE subscription_status USING status::subscription_status,
  ALTER COLUMN status SET DEFAULT 'Active',
  ALTER COLUMN renewal_date SET NOT NULL,
  ADD COLUMN last_used_date DATE,
  ADD CONSTRAINT chk_subscription_cost CHECK (cost > 0),
  ADD CONSTRAINT chk_subscription_renewal_date CHECK (renewal_date >= start_date),
  ADD CONSTRAINT chk_subscription_last_used_date
    CHECK (last_used_date IS NULL OR last_used_date >= start_date),
  ADD CONSTRAINT chk_subscription_cancellation CHECK (
    (status = 'Cancelled' AND cancelled_at IS NOT NULL)
    OR (status = 'Active' AND cancelled_at IS NULL)
  ),
  -- Target of the payment currency composite FK.
  ADD CONSTRAINT uq_subscription_id_currency UNIQUE (subscription_id, currency_code);

ALTER TABLE subscription RENAME CONSTRAINT uq_subscriptions_user_id_id TO uq_subscription_user_id_id;
ALTER TABLE subscription RENAME CONSTRAINT chk_subscriptions_plan_name TO chk_subscription_plan_name;
ALTER TABLE subscription RENAME CONSTRAINT chk_subscriptions_currency TO chk_subscription_currency;
ALTER TABLE subscription RENAME CONSTRAINT chk_subscriptions_notes TO chk_subscription_notes;
ALTER INDEX idx_subscriptions_user_status RENAME TO idx_subscription_user_status;
ALTER INDEX idx_subscriptions_category RENAME TO idx_subscription_category;
CREATE INDEX idx_subscription_upcoming_renewal
  ON subscription (user_id, renewal_date)
  WHERE status = 'Active' AND archived_at IS NULL;

-- ---------------------------------------------------------------------------------------------
-- 6. PAYMENT_HISTORY
-- ---------------------------------------------------------------------------------------------
ALTER TABLE payments RENAME TO payment_history;
ALTER TABLE payment_history RENAME COLUMN id TO payment_id;
ALTER TABLE payment_history
  ALTER COLUMN payment_id TYPE INTEGER,
  ALTER COLUMN subscription_id TYPE INTEGER,
  ALTER COLUMN amount TYPE NUMERIC(8, 2);
ALTER TABLE payment_history RENAME CONSTRAINT chk_payments_amount TO chk_payment_history_amount;
ALTER TABLE payment_history RENAME CONSTRAINT chk_payments_currency TO chk_payment_history_currency;
ALTER TABLE payment_history RENAME CONSTRAINT chk_payments_status TO chk_payment_history_status;
ALTER TABLE payment_history RENAME CONSTRAINT chk_payments_billing_period TO chk_payment_history_billing_period;
ALTER TABLE payment_history RENAME CONSTRAINT chk_payments_notes TO chk_payment_history_notes;
ALTER INDEX idx_payments_subscription_date RENAME TO idx_payment_history_subscription_date;
ALTER INDEX idx_payments_completed_date RENAME TO idx_payment_history_completed_date;
ALTER INDEX idx_payments_completed_subscription_covering RENAME TO idx_payment_history_completed_covering;

ALTER TABLE refunds ALTER COLUMN payment_id TYPE INTEGER;

-- ---------------------------------------------------------------------------------------------
-- 7. RECOMMENDATION
-- ---------------------------------------------------------------------------------------------
ALTER TABLE recommendations RENAME TO recommendation;
ALTER TABLE recommendation RENAME COLUMN id TO recommendation_id;
ALTER TABLE recommendation RENAME COLUMN explanation TO recommendation_text;
ALTER TABLE recommendation RENAME COLUMN estimated_savings TO potential_savings;
ALTER TABLE recommendation RENAME COLUMN created_at TO generated_date;
ALTER TABLE recommendation RENAME COLUMN recommendation_type TO rule;

ALTER TABLE recommendation
  DROP CONSTRAINT chk_recommendations_status,
  DROP CONSTRAINT chk_recommendations_resolution,
  DROP CONSTRAINT chk_recommendations_savings,
  DROP CONSTRAINT chk_recommendations_explanation,
  DROP CONSTRAINT chk_recommendations_type,
  ALTER COLUMN status DROP DEFAULT;

-- D2: inactive (retired) rows are deleted; the rest map onto the spec's statuses.
DELETE FROM recommendation_subscriptions
WHERE recommendation_id IN (SELECT recommendation_id FROM recommendation WHERE status = 'inactive');
DELETE FROM recommendation WHERE status = 'inactive';
UPDATE recommendation
SET status = CASE status WHEN 'active' THEN 'Pending' WHEN 'resolved' THEN 'Reviewed' ELSE 'Dismissed' END;

-- D10: single nullable Subscription_ID, taken from the link table's subject row.
ALTER TABLE recommendation ADD COLUMN subscription_id INTEGER;
UPDATE recommendation AS r
SET subscription_id = link.subscription_id
FROM (
  SELECT DISTINCT ON (recommendation_id) recommendation_id, subscription_id
  FROM recommendation_subscriptions
  ORDER BY recommendation_id, (relationship_role = 'subject') DESC, subscription_id
) AS link
WHERE link.recommendation_id = r.recommendation_id;

-- One row per (user, subscription, rule): keep the reviewed/dismissed row, else the newest.
DELETE FROM recommendation_subscriptions
WHERE recommendation_id IN (
  SELECT recommendation_id FROM (
    SELECT recommendation_id,
           row_number() OVER (
             PARTITION BY user_id, subscription_id, rule
             ORDER BY (status <> 'Pending') DESC, evaluated_at DESC, recommendation_id DESC
           ) AS position
    FROM recommendation
  ) ranked
  WHERE position > 1
);
DELETE FROM recommendation
WHERE recommendation_id IN (
  SELECT recommendation_id FROM (
    SELECT recommendation_id,
           row_number() OVER (
             PARTITION BY user_id, subscription_id, rule
             ORDER BY (status <> 'Pending') DESC, evaluated_at DESC, recommendation_id DESC
           ) AS position
    FROM recommendation
  ) ranked
  WHERE position > 1
);

UPDATE recommendation SET potential_savings = 0 WHERE potential_savings IS NULL;
UPDATE recommendation
SET recommendation_text = left(recommendation_text, 252) || '...'
WHERE char_length(recommendation_text) > 255;

ALTER TABLE recommendation
  DROP COLUMN evidence,
  DROP COLUMN rule_version,
  DROP COLUMN confidence,
  DROP COLUMN recommendation_key,
  DROP COLUMN source_fingerprint,
  DROP COLUMN savings_period,
  ALTER COLUMN recommendation_id TYPE INTEGER,
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN recommendation_text TYPE VARCHAR(255),
  ALTER COLUMN potential_savings TYPE NUMERIC(8, 2),
  ALTER COLUMN potential_savings SET DEFAULT 0,
  ALTER COLUMN potential_savings SET NOT NULL,
  ALTER COLUMN status TYPE recommendation_status USING status::recommendation_status,
  ALTER COLUMN status SET DEFAULT 'Pending',
  ADD CONSTRAINT chk_recommendation_text
    CHECK (char_length(btrim(recommendation_text)) BETWEEN 1 AND 255),
  ADD CONSTRAINT chk_recommendation_potential_savings CHECK (potential_savings >= 0),
  ADD CONSTRAINT chk_recommendation_currency
    CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT chk_recommendation_rule CHECK (
    rule IN (
      'unused_subscription', 'above_category_average', 'duplicate_category',
      -- rules of the retired JavaScript engine, kept only on reviewed/dismissed history rows
      'potential_overlap', 'price_outlier', 'category_concentration', 'exact_duplicate',
      'high_recurring_cost', 'spending_concentration', 'renewal_review', 'trial_review',
      'billing_plan_review'
    )
  ),
  ADD CONSTRAINT chk_recommendation_resolution CHECK (
    (status = 'Pending' AND resolved_at IS NULL)
    OR (status <> 'Pending' AND resolved_at IS NOT NULL)
  ),
  ADD CONSTRAINT uq_recommendation_user_subscription_rule UNIQUE (user_id, subscription_id, rule);

ALTER TABLE recommendation RENAME CONSTRAINT uq_recommendations_user_id_id TO uq_recommendation_user_id_id;
ALTER TABLE recommendation RENAME CONSTRAINT chk_recommendations_title TO chk_recommendation_title;
ALTER TABLE recommendation RENAME CONSTRAINT chk_recommendations_priority TO chk_recommendation_priority;
ALTER TABLE recommendation RENAME CONSTRAINT chk_recommendations_suggested_action TO chk_recommendation_suggested_action;
ALTER INDEX idx_recommendations_user_status_created RENAME TO idx_recommendation_user_status_generated;
ALTER INDEX idx_recommendations_user_type_priority RENAME TO idx_recommendation_user_rule_priority;
CREATE INDEX idx_recommendation_subscription ON recommendation (subscription_id)
  WHERE subscription_id IS NOT NULL;

-- Kept only until the application stops reading it (dropped in a later migration).
ALTER TABLE recommendation_subscriptions
  ALTER COLUMN recommendation_id TYPE INTEGER,
  ALTER COLUMN subscription_id TYPE INTEGER,
  ALTER COLUMN user_id TYPE INTEGER;

-- ---------------------------------------------------------------------------------------------
-- 8. Remaining child tables
-- ---------------------------------------------------------------------------------------------
ALTER TABLE notifications
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN subscription_id TYPE INTEGER;

ALTER TABLE subscription_audit_events
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN subscription_id TYPE INTEGER;

-- Audit history uses the new field names and value labels.
UPDATE subscription_audit_events
SET changed_fields = array_replace(array_replace(changed_fields, 'price', 'cost'),
                                   'next_renewal_date', 'renewal_date'),
    old_values = jsonb_build_object(
      'status', CASE old_values->>'status' WHEN 'cancelled' THEN 'Cancelled' ELSE 'Active' END,
      'cost', old_values->'price',
      'billingCycle', CASE old_values->>'billingCycle' WHEN 'yearly' THEN 'Yearly' ELSE 'Monthly' END,
      'renewalDate', old_values->'nextRenewalDate'
    ),
    new_values = jsonb_build_object(
      'status', CASE new_values->>'status' WHEN 'cancelled' THEN 'Cancelled' ELSE 'Active' END,
      'cost', new_values->'price',
      'billingCycle', CASE new_values->>'billingCycle' WHEN 'yearly' THEN 'Yearly' ELSE 'Monthly' END,
      'renewalDate', new_values->'nextRenewalDate'
    )
WHERE old_values ? 'price';

-- Primary keys and identity sequences named after the spec tables.
ALTER INDEX users_pkey RENAME TO pk_users;
ALTER INDEX categories_pkey RENAME TO pk_category;
ALTER INDEX subscriptions_pkey RENAME TO pk_subscription;
ALTER INDEX payments_pkey RENAME TO pk_payment_history;
ALTER INDEX recommendations_pkey RENAME TO pk_recommendation;
ALTER SEQUENCE users_id_seq RENAME TO users_user_id_seq;
ALTER SEQUENCE categories_id_seq RENAME TO category_category_id_seq;
ALTER SEQUENCE subscriptions_id_seq RENAME TO subscription_subscription_id_seq;
ALTER SEQUENCE payments_id_seq RENAME TO payment_history_payment_id_seq;
ALTER SEQUENCE recommendations_id_seq RENAME TO recommendation_recommendation_id_seq;

-- ---------------------------------------------------------------------------------------------
-- 9. Foreign keys with the spec's delete policy (D11)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE user_preferences
  ADD CONSTRAINT fk_user_preferences_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE;
ALTER TABLE auth_sessions
  ADD CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT;
ALTER TABLE services
  ADD CONSTRAINT fk_services_default_category
    FOREIGN KEY (default_category_id) REFERENCES category (category_id) ON DELETE SET NULL;

ALTER TABLE subscription
  ADD CONSTRAINT fk_subscription_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_subscription_category
    FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE RESTRICT;

ALTER TABLE payment_history
  ADD CONSTRAINT fk_payment_history_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscription (subscription_id) ON DELETE CASCADE,
  -- A payment is always in its subscription's currency (ON UPDATE RESTRICT: the currency of a
  -- subscription that already has payments cannot change).
  ADD CONSTRAINT fk_payment_history_subscription_currency
    FOREIGN KEY (subscription_id, currency_code)
    REFERENCES subscription (subscription_id, currency_code)
    ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE refunds
  ADD CONSTRAINT fk_refunds_payment
    FOREIGN KEY (payment_id) REFERENCES payment_history (payment_id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_notifications_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscription (user_id, subscription_id) ON DELETE CASCADE;

ALTER TABLE subscription_audit_events
  ADD CONSTRAINT fk_subscription_audit_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscription (user_id, subscription_id) ON DELETE CASCADE;

ALTER TABLE recommendation
  ADD CONSTRAINT fk_recommendation_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  -- Composite so a recommendation can only point at its owner's subscription; deleting the
  -- subscription nulls only subscription_id (PostgreSQL 15+ column list).
  ADD CONSTRAINT fk_recommendation_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscription (user_id, subscription_id) ON DELETE SET NULL (subscription_id);

ALTER TABLE recommendation_subscriptions
  ADD CONSTRAINT fk_recommendation_subscriptions_owned_recommendation
    FOREIGN KEY (user_id, recommendation_id)
    REFERENCES recommendation (user_id, recommendation_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_recommendation_subscriptions_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscription (user_id, subscription_id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- 10. Audit trigger, rewritten for the renamed columns (plpgsql bodies do not follow renames)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION spendwise_audit_subscription_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_changed_fields TEXT[];
BEGIN
  v_changed_fields := array_remove(ARRAY[
    CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status' END,
    CASE WHEN OLD.cost IS DISTINCT FROM NEW.cost THEN 'cost' END,
    CASE WHEN OLD.billing_cycle IS DISTINCT FROM NEW.billing_cycle THEN 'billing_cycle' END,
    CASE WHEN OLD.renewal_date IS DISTINCT FROM NEW.renewal_date THEN 'renewal_date' END
  ], NULL);

  IF cardinality(v_changed_fields) > 0 THEN
    INSERT INTO subscription_audit_events (
      subscription_id, user_id, changed_fields, old_values, new_values
    ) VALUES (
      NEW.subscription_id,
      NEW.user_id,
      v_changed_fields,
      jsonb_build_object(
        'status', OLD.status, 'cost', OLD.cost,
        'billingCycle', OLD.billing_cycle, 'renewalDate', OLD.renewal_date
      ),
      jsonb_build_object(
        'status', NEW.status, 'cost', NEW.cost,
        'billingCycle', NEW.billing_cycle, 'renewalDate', NEW.renewal_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_audit_terms
AFTER UPDATE OF status, cost, billing_cycle, renewal_date
ON subscription
FOR EACH ROW
EXECUTE FUNCTION spendwise_audit_subscription_changes();
