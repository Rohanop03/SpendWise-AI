CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_users_display_name
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100),
  CONSTRAINT chk_users_email
    CHECK (
      email = btrim(email)
      AND char_length(email) <= 320
      AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  CONSTRAINT chk_users_password_hash
    CHECK (char_length(password_hash) BETWEEN 30 AND 255),
  CONSTRAINT chk_users_account_status
    CHECK (account_status IN ('active', 'disabled'))
);

CREATE UNIQUE INDEX uq_users_email_ci ON users (lower(email));

CREATE TABLE user_preferences (
  user_id BIGINT PRIMARY KEY,
  preferred_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  renewal_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  renewal_reminder_days SMALLINT NOT NULL DEFAULT 7,
  trial_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  trial_reminder_days SMALLINT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_preferences_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_user_preferences_currency
    CHECK (preferred_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_user_preferences_timezone
    CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 100),
  CONSTRAINT chk_user_preferences_renewal_days
    CHECK (renewal_reminder_days BETWEEN 0 AND 365),
  CONSTRAINT chk_user_preferences_trial_days
    CHECK (trial_reminder_days BETWEEN 0 AND 365)
);

CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_categories_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT chk_categories_description
    CHECK (description IS NULL OR char_length(description) <= 1000)
);

CREATE UNIQUE INDEX uq_categories_name_ci ON categories (lower(name));

CREATE TABLE services (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  default_category_id BIGINT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_default_category
    FOREIGN KEY (default_category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT chk_services_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT chk_services_website_url
    CHECK (website_url IS NULL OR website_url ~* '^https?://[^[:space:]]+$')
);

CREATE UNIQUE INDEX uq_services_name_ci ON services (lower(name));
CREATE INDEX idx_services_default_category ON services (default_category_id);

CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  service_id BIGINT,
  custom_service_name VARCHAR(120),
  category_id BIGINT NOT NULL,
  plan_name VARCHAR(120),
  price NUMERIC(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  next_renewal_date DATE,
  trial_end_date DATE,
  cancelled_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_subscriptions_user_id_id UNIQUE (user_id, id),
  CONSTRAINT fk_subscriptions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscriptions_service
    FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscriptions_category
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT chk_subscriptions_service_source
    CHECK (
      (service_id IS NOT NULL AND custom_service_name IS NULL)
      OR (
        service_id IS NULL
        AND custom_service_name IS NOT NULL
        AND char_length(btrim(custom_service_name)) BETWEEN 1 AND 120
      )
    ),
  CONSTRAINT chk_subscriptions_plan_name
    CHECK (plan_name IS NULL OR char_length(btrim(plan_name)) BETWEEN 1 AND 120),
  CONSTRAINT chk_subscriptions_price
    CHECK (price >= 0),
  CONSTRAINT chk_subscriptions_currency
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_subscriptions_billing_cycle
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trial', 'active', 'paused', 'cancelled')),
  CONSTRAINT chk_subscriptions_next_renewal
    CHECK (
      (next_renewal_date IS NULL OR next_renewal_date >= start_date)
      AND (status NOT IN ('trial', 'active') OR next_renewal_date IS NOT NULL)
    ),
  CONSTRAINT chk_subscriptions_trial_end
    CHECK (
      (trial_end_date IS NULL OR trial_end_date >= start_date)
      AND (status <> 'trial' OR trial_end_date IS NOT NULL)
    ),
  CONSTRAINT chk_subscriptions_cancellation
    CHECK (
      (status = 'cancelled' AND cancelled_at IS NOT NULL)
      OR (status <> 'cancelled' AND cancelled_at IS NULL)
    ),
  CONSTRAINT chk_subscriptions_notes
    CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX idx_subscriptions_user_status ON subscriptions (user_id, status);
CREATE INDEX idx_subscriptions_category ON subscriptions (category_id);
CREATE INDEX idx_subscriptions_service ON subscriptions (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX idx_subscriptions_upcoming_renewal
  ON subscriptions (user_id, next_renewal_date)
  WHERE archived_at IS NULL AND status IN ('trial', 'active');

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id BIGINT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  payment_date DATE NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  billing_period_start DATE,
  billing_period_end DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount
    CHECK (amount > 0),
  CONSTRAINT chk_payments_currency
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_payments_status
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT chk_payments_billing_period
    CHECK (
      (billing_period_start IS NULL AND billing_period_end IS NULL)
      OR (
        billing_period_start IS NOT NULL
        AND billing_period_end IS NOT NULL
        AND billing_period_end >= billing_period_start
      )
    ),
  CONSTRAINT chk_payments_notes
    CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX idx_payments_subscription_date
  ON payments (subscription_id, payment_date DESC);
CREATE INDEX idx_payments_completed_date
  ON payments (payment_date, currency_code)
  WHERE payment_status = 'completed';

CREATE TABLE refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  refund_date DATE NOT NULL,
  refund_status VARCHAR(20) NOT NULL DEFAULT 'completed',
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refunds_payment
    FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
  CONSTRAINT chk_refunds_amount
    CHECK (amount > 0),
  CONSTRAINT chk_refunds_status
    CHECK (refund_status IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT chk_refunds_reason
    CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500)
);

CREATE INDEX idx_refunds_payment_date ON refunds (payment_id, refund_date DESC);

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subscription_id BIGINT,
  notification_type VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  deduplication_key VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_notifications_user_deduplication UNIQUE (user_id, deduplication_key),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscriptions (user_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_notifications_type
    CHECK (notification_type IN ('renewal', 'trial_expiration', 'system')),
  CONSTRAINT chk_notifications_subscription_type
    CHECK (notification_type = 'system' OR subscription_id IS NOT NULL),
  CONSTRAINT chk_notifications_title
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT chk_notifications_message
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  CONSTRAINT chk_notifications_read_state
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR (is_read = TRUE AND read_at IS NOT NULL)
    ),
  CONSTRAINT chk_notifications_deduplication_key
    CHECK (char_length(btrim(deduplication_key)) BETWEEN 1 AND 200)
);

CREATE INDEX idx_notifications_user_unread_created
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_scheduled_for
  ON notifications (scheduled_for)
  WHERE is_read = FALSE;

CREATE TABLE recommendations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  recommendation_type VARCHAR(40) NOT NULL,
  explanation TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  rule_version VARCHAR(40) NOT NULL,
  estimated_savings NUMERIC(12, 2),
  currency_code VARCHAR(3),
  savings_period VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_recommendations_user_id_id UNIQUE (user_id, id),
  CONSTRAINT fk_recommendations_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_recommendations_type
    CHECK (
      recommendation_type IN ('potential_overlap', 'price_outlier', 'category_concentration')
    ),
  CONSTRAINT chk_recommendations_explanation
    CHECK (char_length(btrim(explanation)) BETWEEN 1 AND 4000),
  CONSTRAINT chk_recommendations_evidence
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT chk_recommendations_rule_version
    CHECK (char_length(btrim(rule_version)) BETWEEN 1 AND 40),
  CONSTRAINT chk_recommendations_savings
    CHECK (
      (
        estimated_savings IS NULL
        AND currency_code IS NULL
        AND savings_period IS NULL
      )
      OR (
        estimated_savings IS NOT NULL
        AND estimated_savings >= 0
        AND currency_code IS NOT NULL
        AND currency_code ~ '^[A-Z]{3}$'
        AND savings_period IS NOT NULL
        AND savings_period IN ('monthly', 'yearly', 'one_time')
      )
    ),
  CONSTRAINT chk_recommendations_status
    CHECK (status IN ('active', 'dismissed', 'resolved')),
  CONSTRAINT chk_recommendations_resolution
    CHECK (
      (status = 'active' AND resolved_at IS NULL)
      OR (status IN ('dismissed', 'resolved') AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX idx_recommendations_user_status_created
  ON recommendations (user_id, status, created_at DESC);

CREATE TABLE recommendation_subscriptions (
  recommendation_id BIGINT NOT NULL,
  subscription_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  relationship_role VARCHAR(20) NOT NULL DEFAULT 'subject',
  PRIMARY KEY (recommendation_id, subscription_id),
  CONSTRAINT fk_recommendation_subscriptions_owned_recommendation
    FOREIGN KEY (user_id, recommendation_id)
    REFERENCES recommendations (user_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_recommendation_subscriptions_owned_subscription
    FOREIGN KEY (user_id, subscription_id)
    REFERENCES subscriptions (user_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_recommendation_subscriptions_role
    CHECK (relationship_role IN ('subject', 'comparison'))
);

CREATE INDEX idx_recommendation_subscriptions_subscription
  ON recommendation_subscriptions (subscription_id);
