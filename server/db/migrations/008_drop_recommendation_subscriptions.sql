-- 008: one source of truth for recommendation -> subscription (D10).
-- Migration 006 copied each recommendation's subject subscription into
-- recommendation.subscription_id; the application no longer reads the link table.
DROP TABLE recommendation_subscriptions;
