ALTER TABLE recommendations
  DROP CONSTRAINT chk_recommendations_type,
  DROP CONSTRAINT chk_recommendations_status,
  DROP CONSTRAINT chk_recommendations_resolution;

ALTER TABLE recommendations
  ADD COLUMN title VARCHAR(160),
  ADD COLUMN priority VARCHAR(10),
  ADD COLUMN confidence VARCHAR(10),
  ADD COLUMN suggested_action VARCHAR(500),
  ADD COLUMN recommendation_key VARCHAR(200),
  ADD COLUMN source_fingerprint VARCHAR(64),
  ADD COLUMN evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE recommendations
SET title = 'Subscription cost recommendation',
    priority = 'medium',
    confidence = 'medium',
    suggested_action = 'Review the associated subscriptions.',
    recommendation_key = 'legacy:' || id,
    source_fingerprint = repeat('0', 64);

ALTER TABLE recommendations
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN confidence SET NOT NULL,
  ALTER COLUMN suggested_action SET NOT NULL,
  ALTER COLUMN recommendation_key SET NOT NULL,
  ALTER COLUMN source_fingerprint SET NOT NULL,
  ADD CONSTRAINT uq_recommendations_user_key UNIQUE (user_id, recommendation_key),
  ADD CONSTRAINT chk_recommendations_type CHECK (
    recommendation_type IN (
      'potential_overlap', 'price_outlier', 'category_concentration',
      'exact_duplicate', 'high_recurring_cost', 'spending_concentration',
      'renewal_review', 'trial_review', 'billing_plan_review'
    )
  ),
  ADD CONSTRAINT chk_recommendations_title
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  ADD CONSTRAINT chk_recommendations_priority
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD CONSTRAINT chk_recommendations_confidence
    CHECK (confidence IN ('high', 'medium', 'low')),
  ADD CONSTRAINT chk_recommendations_suggested_action
    CHECK (char_length(btrim(suggested_action)) BETWEEN 1 AND 500),
  ADD CONSTRAINT chk_recommendations_key
    CHECK (char_length(btrim(recommendation_key)) BETWEEN 1 AND 200),
  ADD CONSTRAINT chk_recommendations_fingerprint
    CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT chk_recommendations_status
    CHECK (status IN ('active', 'dismissed', 'resolved', 'inactive')),
  ADD CONSTRAINT chk_recommendations_resolution CHECK (
    (status = 'active' AND resolved_at IS NULL)
    OR (status IN ('dismissed', 'resolved', 'inactive') AND resolved_at IS NOT NULL)
  );

CREATE INDEX idx_recommendations_user_type_priority
  ON recommendations (user_id, recommendation_type, priority, evaluated_at DESC);
