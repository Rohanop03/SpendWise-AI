# DBMS SQL Demonstrations

These examples use the real SpendWise AI schema. Run read examples against a disposable account. Run writes, isolation, locks, and plans only in `spendwise_test`. Replace `$1` with a parameter through `pg`; do not concatenate user input.

## Joins, CASE, and COALESCE

Purpose: list owned subscriptions with optional catalog names and a normalized status label. Tables: `subscriptions`, `services`, `categories`. Expected result: one row per matching owned subscription.

```sql
SELECT s.id,
       COALESCE(svc.name, s.custom_service_name) AS service_name,
       c.name AS category_name,
       CASE WHEN s.archived_at IS NULL THEN s.status ELSE 'archived' END AS lifecycle
FROM subscriptions AS s
INNER JOIN categories AS c ON c.id = s.category_id
LEFT JOIN services AS svc ON svc.id = s.service_id
WHERE s.user_id = $1;
```

The INNER JOIN requires a valid category; the LEFT JOIN preserves custom services. The ownership predicate is mandatory.

## Meaningful self join

Purpose: find distinct pairs of active owned subscriptions in the same category. Expected result: candidate overlaps, never a row paired with itself.

```sql
SELECT left_sub.id, right_sub.id, left_sub.category_id
FROM subscriptions AS left_sub
JOIN subscriptions AS right_sub
  ON right_sub.user_id = left_sub.user_id
 AND right_sub.category_id = left_sub.category_id
 AND right_sub.id > left_sub.id
WHERE left_sub.user_id = $1
  AND left_sub.status = 'active'
  AND right_sub.status = 'active';
```

## Aggregates, GROUP BY, HAVING, and FILTER

Purpose: summarize realized payments by owned subscription and retain only subscriptions with at least two payments. Uses `SUM`, `AVG`, `MIN`, `MAX`, and `FILTER`.

```sql
SELECT p.subscription_id,
       COUNT(*) FILTER (WHERE p.payment_status = 'completed') AS completed_count,
       SUM(p.amount) FILTER (WHERE p.payment_status = 'completed') AS gross,
       AVG(p.amount) FILTER (WHERE p.payment_status = 'completed') AS average_payment,
       MIN(p.payment_date) AS first_payment,
       MAX(p.payment_date) AS last_payment
FROM payments AS p
JOIN subscriptions AS s ON s.id = p.subscription_id
WHERE s.user_id = $1
GROUP BY p.subscription_id
HAVING COUNT(*) FILTER (WHERE p.payment_status = 'completed') >= 2;
```

Currency must be added to both SELECT and GROUP BY when multiple currencies may occur.

## Subquery, correlated subquery, EXISTS, and NOT EXISTS

Purpose: identify above-average subscriptions, determine whether each has payments, and find active subscriptions without completed payments.

```sql
SELECT s.id, s.price
FROM subscriptions AS s
WHERE s.user_id = $1
  AND s.price > (
    SELECT AVG(peer.price)
    FROM subscriptions AS peer
    WHERE peer.user_id = s.user_id
      AND peer.currency_code = s.currency_code
  );

SELECT s.id,
       EXISTS (SELECT 1 FROM payments p WHERE p.subscription_id = s.id) AS has_payments
FROM subscriptions s
WHERE s.user_id = $1;

SELECT s.id
FROM subscriptions s
WHERE s.user_id = $1
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.subscription_id = s.id AND p.payment_status = 'completed'
  );
```

The first inner query is correlated by user and currency. All outer rows are ownership-scoped.

## CTEs and refund-safe aggregation

Purpose: calculate cash flow without multiplying a payment when it has multiple refunds.

```sql
WITH payment_totals AS (
  SELECT p.currency_code, SUM(p.amount) AS gross
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1 AND p.payment_status = 'completed'
  GROUP BY p.currency_code
), refund_totals AS (
  SELECT p.currency_code, SUM(r.amount) AS refunded
  FROM refunds r
  JOIN payments p ON p.id = r.payment_id
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1 AND r.refund_status = 'completed'
  GROUP BY p.currency_code
)
SELECT p.currency_code, p.gross,
       COALESCE(r.refunded, 0) AS refunded,
       p.gross - COALESCE(r.refunded, 0) AS net
FROM payment_totals p
LEFT JOIN refund_totals r USING (currency_code);
```

## Window functions

Purpose: rank subscriptions by realized spend while returning pagination totals. `ROW_NUMBER` is unique ordering, `DENSE_RANK` preserves ties, and `COUNT(*) OVER` gives the unpaginated count.

```sql
WITH totals AS (
  SELECT s.id, s.user_id, SUM(p.amount) AS gross
  FROM subscriptions s
  JOIN payments p ON p.subscription_id = s.id
  WHERE s.user_id = $1 AND p.payment_status = 'completed'
  GROUP BY s.id, s.user_id
)
SELECT id, gross,
       ROW_NUMBER() OVER (ORDER BY gross DESC, id) AS row_number,
       DENSE_RANK() OVER (ORDER BY gross DESC) AS spending_rank,
       COUNT(*) OVER () AS total_rows
FROM totals
ORDER BY row_number;
```

## DATE_TRUNC and generate_series

Purpose: return every month even when no completed payment occurred.

```sql
WITH months AS (
  SELECT generate_series(
    date_trunc('month', $2::date),
    date_trunc('month', $3::date),
    interval '1 month'
  )::date AS month_start
), totals AS (
  SELECT date_trunc('month', p.payment_date)::date AS month_start,
         p.currency_code, SUM(p.amount) AS gross
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1 AND p.payment_status = 'completed'
  GROUP BY 1, p.currency_code
)
SELECT m.month_start, t.currency_code, COALESCE(t.gross, 0) AS gross
FROM months m LEFT JOIN totals t USING (month_start)
ORDER BY m.month_start, t.currency_code;
```

## Stored functions, procedure, trigger, and views

```sql
SELECT spendwise_monthly_equivalent(100, 'yearly');
SELECT * FROM spendwise_user_financial_summary($1, $2, $3);

CALL spendwise_retire_stale_recommendations(
  $1, 'stage10-v1', $2::varchar[], CURRENT_TIMESTAMP, 0
);

SELECT * FROM active_subscription_commitments WHERE user_id = $1;
SELECT * FROM completed_payment_financials WHERE user_id = $1;
```

Updating `subscriptions.price`, `status`, `billing_cycle`, or `next_renewal_date` invokes `trg_subscriptions_audit_terms`; inspect owned audit rows internally:

```sql
SELECT changed_fields, old_values, new_values, changed_at
FROM subscription_audit_events
WHERE user_id = $1 AND subscription_id = $2
ORDER BY changed_at;
```

## Transactions, SAVEPOINT, and ROLLBACK

Purpose: keep a multi-step recommendation write atomic while recovering from an optional association error.

```sql
BEGIN;
INSERT INTO recommendations (
  user_id, recommendation_type, title, explanation, rule_version, priority,
  confidence, suggested_action, recommendation_key, source_fingerprint
) VALUES ($1, 'price_outlier', $2, $3, 'demo-v1', 'low', 'medium', $4, $5, $6);

SAVEPOINT before_optional_association;
INSERT INTO recommendation_subscriptions (recommendation_id, subscription_id, user_id)
VALUES ($7, $8, $1);
-- On an optional-association error:
ROLLBACK TO SAVEPOINT before_optional_association;
COMMIT;
```

Use plain `ROLLBACK` instead of COMMIT when the recommendation itself must not persist.

## Isolation and row locks

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SELECT id FROM payments WHERE id = $1 FOR UPDATE;
-- Recalculate completed refunds and insert safely.
COMMIT;

BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT display_name FROM users WHERE id = $1;
SELECT display_name FROM users WHERE id = $1; -- same snapshot
COMMIT;

BEGIN ISOLATION LEVEL SERIALIZABLE;
-- Execute the protected read/write unit and retry the whole unit on 40001.
COMMIT;
```

The controlled `npm run db:demo` command uses two independent clients. It also creates opposite lock order to verify `40P01`; production transactions should lock rows in consistent order.

## Index inspection and query plans

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT currency_code, COUNT(*), SUM(amount)
FROM payments
WHERE subscription_id = $1
  AND payment_status = 'completed'
  AND payment_date >= DATE '2024-01-01'
GROUP BY currency_code;
```

`EXPLAIN ANALYZE` executes the SELECT. The Stage 11 partial covering index changes this benchmark from Index Scan to Index Only Scan. Do not run analyzed mutating statements against development data.
