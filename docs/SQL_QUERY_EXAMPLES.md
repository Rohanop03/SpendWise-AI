# SQL Query Examples

For Stage 11 joins, subqueries, aggregates, CTEs, window functions, routines, triggers, views, transactions, savepoints, locks, indexes, and execution plans, see [DBMS SQL Demonstrations](DBMS_SQL_DEMONSTRATIONS.md).

These examples use the implemented PostgreSQL schema. `$1`, `$2`, and similar markers are `pg` parameters; values must be passed separately rather than concatenated into SQL. Monetary results are grouped by currency because SpendWise AI has no exchange-rate source.

## 1. Basic `SELECT`

List the shared category catalog:

```sql
SELECT id, name, description
FROM categories
ORDER BY name;
```

## 2. `INSERT`

Create a user-owned custom subscription. Exactly one of `service_id` and `custom_service_name` must be present.

```sql
INSERT INTO subscriptions (
  user_id,
  service_id,
  custom_service_name,
  category_id,
  plan_name,
  price,
  currency_code,
  billing_cycle,
  status,
  start_date,
  next_renewal_date
)
VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'active', $8, $9)
RETURNING id;
```

Example parameter meanings: user ID, custom provider name, category ID, plan, current price, currency, cycle, start date, and next renewal date.

## 3. `UPDATE`

Archive one subscription while retaining payments. The ownership predicate is essential in a future authenticated repository.

```sql
UPDATE subscriptions
SET archived_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND user_id = $2
RETURNING id, archived_at;
```

## 4. Safe `DELETE` example

This deletes only an intentionally named, unreferenced sample category. It will fail safely if a subscription references it.

```sql
BEGIN;

INSERT INTO categories (name, description)
VALUES ('Temporary SQL Demo', 'Disposable documentation example')
ON CONFLICT ((lower(name))) DO NOTHING;

DELETE FROM categories
WHERE lower(name) = lower('Temporary SQL Demo');

COMMIT;
```

Do not use bulk deletes against users, subscriptions, payments, or refunds. Ordinary subscription removal uses `archived_at`.

## 5. `INNER JOIN`

Show subscription names with category data. `COALESCE` selects the catalog service or custom service name.

```sql
SELECT
  sub.id,
  COALESCE(svc.name, sub.custom_service_name) AS subscription_name,
  cat.name AS category_name,
  sub.price,
  sub.currency_code,
  sub.billing_cycle
FROM subscriptions AS sub
INNER JOIN categories AS cat ON cat.id = sub.category_id
LEFT JOIN services AS svc ON svc.id = sub.service_id
WHERE sub.user_id = $1
  AND sub.archived_at IS NULL
ORDER BY subscription_name;
```

## 6. `LEFT JOIN`

Include subscriptions that have no payment history:

```sql
SELECT
  sub.id,
  COALESCE(svc.name, sub.custom_service_name) AS subscription_name,
  COUNT(p.id) AS recorded_payment_count
FROM subscriptions AS sub
LEFT JOIN services AS svc ON svc.id = sub.service_id
LEFT JOIN payments AS p ON p.subscription_id = sub.id
WHERE sub.user_id = $1
GROUP BY sub.id, svc.name, sub.custom_service_name
ORDER BY subscription_name;
```

## 7. `WHERE`

Find active/trial renewals in a date window:

```sql
SELECT id, next_renewal_date, price, currency_code
FROM subscriptions
WHERE user_id = $1
  AND archived_at IS NULL
  AND status IN ('trial', 'active')
  AND next_renewal_date BETWEEN $2::date AND $3::date;
```

These are projected renewals from current terms, not completed payments.

## 8. `ORDER BY`

Retrieve newest payment events for one owned subscription:

```sql
SELECT p.id, p.payment_date, p.amount, p.currency_code, p.payment_status
FROM payments AS p
INNER JOIN subscriptions AS sub ON sub.id = p.subscription_id
WHERE p.subscription_id = $1
  AND sub.user_id = $2
ORDER BY p.payment_date DESC, p.id DESC;
```

## 9. `GROUP BY`

Calculate realized net spending without multiplying payments by multiple refund rows. Refunds are aggregated before joining:

```sql
WITH completed_refunds AS (
  SELECT payment_id, SUM(amount) AS refunded_amount
  FROM refunds
  WHERE refund_status = 'completed'
  GROUP BY payment_id
)
SELECT
  p.currency_code,
  SUM(p.amount - COALESCE(r.refunded_amount, 0)) AS net_realized_spend
FROM payments AS p
INNER JOIN subscriptions AS sub ON sub.id = p.subscription_id
LEFT JOIN completed_refunds AS r ON r.payment_id = p.id
WHERE sub.user_id = $1
  AND p.payment_status = 'completed'
  AND p.payment_date BETWEEN $2::date AND $3::date
GROUP BY p.currency_code
ORDER BY p.currency_code;
```

## 10. `COUNT`

Count active, non-archived subscriptions for one user:

```sql
SELECT COUNT(*) AS active_subscription_count
FROM subscriptions
WHERE user_id = $1
  AND status = 'active'
  AND archived_at IS NULL;
```

## 11. `SUM`

Project current yearly cost by currency. This uses current subscription terms, not payment history:

```sql
SELECT
  currency_code,
  SUM(
    CASE billing_cycle
      WHEN 'monthly' THEN price * 12
      WHEN 'quarterly' THEN price * 4
      WHEN 'yearly' THEN price
    END
  ) AS projected_yearly_cost
FROM subscriptions
WHERE user_id = $1
  AND status IN ('trial', 'active')
  AND archived_at IS NULL
GROUP BY currency_code
ORDER BY currency_code;
```

## 12. `AVG`

Compare completed payment sizes within each currency and category:

```sql
SELECT
  cat.name AS category_name,
  p.currency_code,
  ROUND(AVG(p.amount), 2) AS average_completed_payment
FROM payments AS p
INNER JOIN subscriptions AS sub ON sub.id = p.subscription_id
INNER JOIN categories AS cat ON cat.id = sub.category_id
WHERE sub.user_id = $1
  AND p.payment_status = 'completed'
GROUP BY cat.id, cat.name, p.currency_code
ORDER BY cat.name, p.currency_code;
```

## 13. Simple subquery

Find a user's current subscriptions priced above that user's average within the same currency:

```sql
SELECT outer_sub.id, outer_sub.price, outer_sub.currency_code
FROM subscriptions AS outer_sub
WHERE outer_sub.user_id = $1
  AND outer_sub.archived_at IS NULL
  AND outer_sub.price > (
    SELECT AVG(inner_sub.price)
    FROM subscriptions AS inner_sub
    WHERE inner_sub.user_id = outer_sub.user_id
      AND inner_sub.currency_code = outer_sub.currency_code
      AND inner_sub.archived_at IS NULL
  )
ORDER BY outer_sub.currency_code, outer_sub.price DESC;
```

## 14. Transaction example

Account registration in Stage 4 will create identity and default preferences atomically. If either statement fails, neither persists:

```sql
BEGIN;

WITH new_user AS (
  INSERT INTO users (display_name, email, password_hash)
  VALUES ($1, $2, $3)
  RETURNING id
)
INSERT INTO user_preferences (user_id)
SELECT id FROM new_user;

COMMIT;
```

Application code uses `database.withTransaction(...)`, which acquires one pool client, issues `BEGIN`, commits on success, rolls back on failure, and always releases the client. Password hashing and the registration endpoint remain Stage 4 work.

## Constraint validation examples

Run deliberately invalid statements only inside a disposable test transaction:

```sql
BEGIN;

-- Expected to fail: unsupported cycle and negative price.
INSERT INTO subscriptions (
  user_id,
  custom_service_name,
  category_id,
  price,
  currency_code,
  billing_cycle,
  status,
  start_date,
  next_renewal_date
)
VALUES ($1, 'Constraint Demo', $2, -1, 'usd', 'weekly', 'active', CURRENT_DATE, CURRENT_DATE);

ROLLBACK;
```

PostgreSQL aborts the transaction after the rejected insert; issue `ROLLBACK` before continuing. A constraint rejection is successful integrity validation, not a database malfunction.
