# SpendWise AI — Analytics SQL Queries & DBMS Architecture Guide

> Prepared for university Database Management Systems (DBMS) evaluation and technical presentation.

This document presents the actual PostgreSQL 18.6 queries powering **SpendWise AI Stage 7: Spending Analytics & SQL Reporting**.

Every query demonstrates fundamental relational database concepts: multi-table joins, conditional aggregations, Common Table Expressions (CTEs), calendar sequence generation, window functions, and strict multi-tenant parameterization.

---

## 1. Relational Schema Summary

The analytics engine operates on the following core normalized tables:

```
┌──────────────┐          ┌───────────────────────┐          ┌──────────────┐
│  categories  │◄─────────┤     subscriptions     ├─────────►│   services   │
└──────────────┘          └───────────┬───────────┘          └──────────────┘
                                      │ 1
                                      │
                                      ▼ N
                          ┌───────────────────────┐
                          │       payments        │
                          └───────────┬───────────┘
                                      │ 1
                                      │
                                      ▼ N
                          ┌───────────────────────┐
                          │        refunds        │
                          └───────────────────────┘
```

1. **`users` (`id`, `email`, `display_name`, ...)**: Root tenant identity.
2. **`subscriptions` (`id`, `user_id`, `category_id`, `service_id`, `custom_service_name`, `price`, `currency_code`, `billing_cycle`, `status`, `start_date`, `next_renewal_date`, `archived_at`)**: User recurring contracts.
3. **`categories` (`id`, `name`)**: Subscription taxonomy.
4. **`services` (`id`, `name`)**: Standard reference service catalog.
5. **`payments` (`id`, `subscription_id`, `amount`, `currency_code`, `payment_date`, `payment_status`, `billing_period_start`, `billing_period_end`)**: Historical cash outflow transactions.
6. **`refunds` (`id`, `payment_id`, `amount`, `refund_date`, `refund_status`, `reason`)**: Cash reimbursement transactions tied to a completed parent payment.

---

## 2. Core DBMS Concepts Demonstrated

| Concept | SQL Syntax / Function | Purpose in SpendWise AI |
| :--- | :--- | :--- |
| **Common Table Expressions** | `WITH name AS (...)` | Eliminates 1-to-many join multiplication between payments and refunds |
| **Inner Join** | `JOIN categories ON ...` | Associates subscriptions with mandatory relational entities |
| **Left Outer Join** | `LEFT JOIN services ON ...` | Preserves custom user subscriptions where `service_id IS NULL` |
| **Conditional Aggregates** | `COUNT(...) FILTER (...)`, `SUM(CASE WHEN ...)` | Calculates payment status counts and gross totals in a single pass |
| **Calendar Generation** | `generate_series(...)` | Synthesizes continuous calendar months to report zero-activity periods |
| **Date Truncation** | `DATE_TRUNC('month', ...)` | Groups continuous timestamps into calendar reporting buckets |
| **Null Coalescing** | `COALESCE(val, fallback)` | Guarantees non-null values for monetary totals and service names |
| **Window Functions** | `COUNT(*) OVER()` | Computes total matching records alongside paginated result subsets |
| **Parameterized Isolation** | `WHERE s.user_id = $1` | Enforces tenant data security without reliance on client input |

---

## 3. Query 1: Financial Overview by Currency (CTEs + Full Disjoint Summaries)

### Purpose
Calculates gross completed payments, completed refunds, net realized cash flow, unconfirmed pending amounts, and active recurring projections grouped strictly by currency.

### SQL Query
```sql
WITH payment_summary AS (
  SELECT
    p.currency_code,
    COALESCE(SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END), 0) AS gross_payments,
    COUNT(CASE WHEN p.payment_status = 'completed' THEN 1 END)::int AS completed_payment_count,
    COUNT(CASE WHEN p.payment_status = 'pending' THEN 1 END)::int AS pending_payment_count,
    COUNT(CASE WHEN p.payment_status IN ('failed', 'cancelled') THEN 1 END)::int AS failed_payment_count,
    COALESCE(SUM(CASE WHEN p.payment_status = 'pending' THEN p.amount ELSE 0 END), 0) AS pending_amount,
    COALESCE(SUM(CASE WHEN p.payment_status IN ('failed', 'cancelled') THEN p.amount ELSE 0 END), 0) AS failed_amount
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND ($2::date IS NULL OR p.payment_date >= $2)
    AND ($3::date IS NULL OR p.payment_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.currency_code
),
refund_summary AS (
  SELECT
    p.currency_code,
    COALESCE(SUM(r.amount), 0) AS completed_refunds,
    COUNT(r.id)::int AS refund_count
  FROM refunds r
  JOIN payments p ON p.id = r.payment_id
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND r.refund_status = 'completed'
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR r.refund_date >= $2)
    AND ($3::date IS NULL OR r.refund_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.currency_code
),
all_currencies AS (
  SELECT currency_code FROM payment_summary
  UNION
  SELECT currency_code FROM refund_summary
)
SELECT
  ac.currency_code,
  COALESCE(ps.gross_payments, 0) AS gross_payments,
  COALESCE(rs.completed_refunds, 0) AS completed_refunds,
  (COALESCE(ps.gross_payments, 0) - COALESCE(rs.completed_refunds, 0)) AS net_cash_flow,
  COALESCE(ps.completed_payment_count, 0) AS completed_payment_count,
  COALESCE(ps.pending_payment_count, 0) AS pending_payment_count,
  COALESCE(ps.failed_payment_count, 0) AS failed_payment_count,
  COALESCE(rs.refund_count, 0) AS refund_count,
  COALESCE(ps.pending_amount, 0) AS pending_amount,
  COALESCE(ps.failed_amount, 0) AS failed_amount
FROM all_currencies ac
LEFT JOIN payment_summary ps ON ps.currency_code = ac.currency_code
LEFT JOIN refund_summary rs ON rs.currency_code = ac.currency_code
ORDER BY ac.currency_code ASC;
```

### DBMS Explanation
1. **CTE Independence:** `payment_summary` aggregates payments independently of `refund_summary`. Joining `payments` directly with `refunds` would duplicate payment rows for every partial refund.
2. **Conditional Aggregation:** Uses `CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END` to sum only realized spending in a single sequential scan of payments.
3. **User Isolation:** Every CTE joins through `subscriptions s` checking `s.user_id = $1`.
4. **Currency Union:** `all_currencies` ensures that periods having refunds but zero payments (or vice versa) are represented cleanly.

---

## 4. Query 2: Monthly Cash Flow Trends with Zero-Activity Gaps (`generate_series`)

### Purpose
Calculates chronological monthly cash flow trends, ensuring months with zero activity are included with `0.00` values rather than vanishing from the report.

### SQL Query
```sql
WITH payment_events AS (
  SELECT
    p.currency_code,
    TO_CHAR(DATE_TRUNC('month', p.payment_date), 'YYYY-MM') AS period,
    DATE_TRUNC('month', p.payment_date)::date AS period_date,
    COALESCE(SUM(p.amount), 0) AS gross_payments,
    COUNT(p.id)::int AS completed_payment_count
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR p.payment_date >= $2)
    AND ($3::date IS NULL OR p.payment_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.currency_code, DATE_TRUNC('month', p.payment_date)
),
refund_events AS (
  SELECT
    p.currency_code,
    TO_CHAR(DATE_TRUNC('month', r.refund_date), 'YYYY-MM') AS period,
    DATE_TRUNC('month', r.refund_date)::date AS period_date,
    COALESCE(SUM(r.amount), 0) AS completed_refunds,
    COUNT(r.id)::int AS refund_count
  FROM refunds r
  JOIN payments p ON p.id = r.payment_id
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND r.refund_status = 'completed'
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR r.refund_date >= $2)
    AND ($3::date IS NULL OR r.refund_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.currency_code, DATE_TRUNC('month', r.refund_date)
),
active_currencies AS (
  SELECT DISTINCT currency_code FROM (
    SELECT currency_code FROM payment_events
    UNION
    SELECT currency_code FROM refund_events
    UNION
    SELECT $4::varchar AS currency_code WHERE $4::varchar IS NOT NULL
  ) c WHERE currency_code IS NOT NULL
),
series_bounds AS (
  SELECT
    COALESCE($2::date, MIN(sub.d), CURRENT_DATE) AS min_d,
    COALESCE($3::date, MAX(sub.d), CURRENT_DATE) AS max_d
  FROM (
    SELECT period_date AS d FROM payment_events
    UNION ALL
    SELECT period_date AS d FROM refund_events
  ) sub
),
calendar_periods AS (
  SELECT
    TO_CHAR(s, 'YYYY-MM') AS period,
    s::date AS period_date
  FROM series_bounds sb,
  LATERAL generate_series(
    DATE_TRUNC('month', sb.min_d),
    DATE_TRUNC('month', sb.max_d),
    '1 month'::interval
  ) s
  WHERE sb.min_d <= sb.max_d
),
matrix AS (
  SELECT
    cp.period,
    cp.period_date,
    ac.currency_code
  FROM calendar_periods cp
  CROSS JOIN active_currencies ac
)
SELECT
  m.period,
  m.currency_code,
  COALESCE(pe.gross_payments, 0) AS gross_payments,
  COALESCE(re.completed_refunds, 0) AS completed_refunds,
  (COALESCE(pe.gross_payments, 0) - COALESCE(re.completed_refunds, 0)) AS net_cash_flow,
  COALESCE(pe.completed_payment_count, 0)::int AS completed_payment_count,
  COALESCE(re.refund_count, 0)::int AS refund_count
FROM matrix m
LEFT JOIN payment_events pe
  ON pe.period = m.period AND pe.currency_code = m.currency_code
LEFT JOIN refund_events re
  ON re.period = m.period AND re.currency_code = m.currency_code
ORDER BY m.currency_code ASC, m.period ASC;
```

### DBMS Explanation
1. **`generate_series`:** Synthesizes an authoritative sequence of calendar months between `min_d` and `max_d`.
2. **`CROSS JOIN` Grid:** Generates all combinations of period and currency, ensuring zero-activity months have a row.
3. **Date-of-Event Attribution:** Payments are bucketed by `DATE_TRUNC('month', p.payment_date)` and refunds by `DATE_TRUNC('month', r.refund_date)`.
4. **Deficit Handling:** If `gross_payments` is 0 and `completed_refunds` is 200, `net_cash_flow` evaluates to `-200.00`.

---

## 5. Query 3: Category Expense Breakdown (CTEs + Relational Taxonomy)

### Purpose
Aggregates spending by subscription category and currency, preventing multi-refund row duplication.

### SQL Query
```sql
WITH payment_cat AS (
  SELECT
    s.category_id,
    p.currency_code,
    COALESCE(SUM(p.amount), 0) AS gross_payments,
    COUNT(p.id)::int AS completed_payment_count
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR p.payment_date >= $2)
    AND ($3::date IS NULL OR p.payment_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
    AND ($5::bigint IS NULL OR s.category_id = $5)
  GROUP BY s.category_id, p.currency_code
),
refund_cat AS (
  SELECT
    s.category_id,
    p.currency_code,
    COALESCE(SUM(r.amount), 0) AS completed_refunds,
    COUNT(r.id)::int AS refund_count
  FROM refunds r
  JOIN payments p ON p.id = r.payment_id
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND r.refund_status = 'completed'
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR r.refund_date >= $2)
    AND ($3::date IS NULL OR r.refund_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
    AND ($5::bigint IS NULL OR s.category_id = $5)
  GROUP BY s.category_id, p.currency_code
),
combined AS (
  SELECT category_id, currency_code FROM payment_cat
  UNION
  SELECT category_id, currency_code FROM refund_cat
)
SELECT
  c.id AS category_id,
  c.name AS category_name,
  comb.currency_code,
  COALESCE(pc.gross_payments, 0) AS gross_payments,
  COALESCE(rc.completed_refunds, 0) AS completed_refunds,
  (COALESCE(pc.gross_payments, 0) - COALESCE(rc.completed_refunds, 0)) AS net_cash_flow,
  COALESCE(pc.completed_payment_count, 0)::int AS completed_payment_count,
  COALESCE(rc.refund_count, 0)::int AS refund_count
FROM combined comb
JOIN categories c ON c.id = comb.category_id
LEFT JOIN payment_cat pc
  ON pc.category_id = comb.category_id AND pc.currency_code = comb.currency_code
LEFT JOIN refund_cat rc
  ON rc.category_id = comb.category_id AND rc.currency_code = comb.currency_code
ORDER BY comb.currency_code ASC, gross_payments DESC, c.name ASC;
```

### DBMS Explanation
1. **Prevents Join Multiplication:** Sums payments by category in `payment_cat` and refunds by category in `refund_cat` before joining.
2. **Category Foreign Key:** Joins with `categories c ON c.id = comb.category_id` to retrieve user-facing category labels.
3. **Reconciliation Invariant:** The sum of `net_cash_flow` across all categories equals the overall net cash flow for that currency.

---

## 6. Query 4: Subscription Analytics with Server-Side Pagination & Window Function

### Purpose
Calculates historical realized spend, refund totals, and forward monthly equivalents per subscription, utilizing `COUNT(*) OVER()` to return total item counts for pagination in a single query.

### SQL Query
```sql
WITH payment_sub AS (
  SELECT
    p.subscription_id,
    COALESCE(SUM(p.amount), 0) AS gross_payments,
    COUNT(p.id)::int AS completed_payment_count
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR p.payment_date >= $2)
    AND ($3::date IS NULL OR p.payment_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.subscription_id
),
refund_sub AS (
  SELECT
    p.subscription_id,
    COALESCE(SUM(r.amount), 0) AS completed_refunds,
    COUNT(r.id)::int AS refund_count
  FROM refunds r
  JOIN payments p ON p.id = r.payment_id
  JOIN subscriptions s ON s.id = p.subscription_id
  WHERE s.user_id = $1
    AND r.refund_status = 'completed'
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR r.refund_date >= $2)
    AND ($3::date IS NULL OR r.refund_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.subscription_id
),
aggregated AS (
  SELECT
    s.id AS subscription_id,
    s.user_id,
    COALESCE(svc.name, s.custom_service_name) AS service_name,
    cat.id AS category_id,
    cat.name AS category_name,
    s.status,
    s.archived_at,
    s.billing_cycle,
    s.currency_code,
    s.price AS current_price,
    COALESCE(ps.gross_payments, 0) AS gross_payments,
    COALESCE(rs.completed_refunds, 0) AS completed_refunds,
    (COALESCE(ps.gross_payments, 0) - COALESCE(rs.completed_refunds, 0)) AS net_cash_flow,
    COALESCE(ps.completed_payment_count, 0)::int AS completed_payment_count,
    COALESCE(rs.refund_count, 0)::int AS refund_count,
    CASE
      WHEN s.archived_at IS NULL AND s.status IN ('active', 'trial') THEN
        CASE s.billing_cycle
          WHEN 'monthly' THEN s.price
          WHEN 'quarterly' THEN ROUND(s.price / 3.0, 2)
          WHEN 'yearly' THEN ROUND(s.price / 12.0, 2)
          ELSE 0
        END
      ELSE 0
    END AS estimated_monthly_cost
  FROM subscriptions s
  LEFT JOIN services svc ON svc.id = s.service_id
  JOIN categories cat ON cat.id = s.category_id
  LEFT JOIN payment_sub ps ON ps.subscription_id = s.id
  LEFT JOIN refund_sub rs ON rs.subscription_id = s.id
  WHERE s.user_id = $1
    AND ($4::varchar IS NULL OR s.currency_code = $4)
    AND (
      COALESCE(ps.completed_payment_count, 0) > 0
      OR COALESCE(rs.refund_count, 0) > 0
      OR ($2::date IS NULL AND $3::date IS NULL AND s.archived_at IS NULL)
    )
)
SELECT
  *,
  COUNT(*) OVER()::int AS total_count
FROM aggregated
ORDER BY gross_payments DESC, service_name ASC
LIMIT $5 OFFSET $6;
```

### DBMS Explanation
1. **Window Function `COUNT(*) OVER()`:** Returns the total matching dataset size in a single database roundtrip, avoiding a separate `COUNT(*)` query for pagination.
2. **Catalog vs. Custom Disjunction:** `COALESCE(svc.name, s.custom_service_name) AS service_name` transparently unifies catalog and custom service subscriptions.
3. **Archived Record Preservation:** Soft-archived subscriptions (`archived_at IS NOT NULL`) are retained in historical spending reports so past cash outflows remain auditable.

---

## 7. Query 5: Billing Cycle Distribution (`CASE` Ordering & Filtered Counting)

### Purpose
Calculates subscription counts and normalized expenditure commitments grouped by billing interval.

### SQL Query
```sql
SELECT
  s.billing_cycle,
  s.currency_code,
  COUNT(s.id)::int AS subscription_count,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END)::int AS active_count,
  COUNT(CASE WHEN s.status = 'trial' THEN 1 END)::int AS trial_count,
  COALESCE(SUM(
    CASE s.billing_cycle
      WHEN 'monthly' THEN s.price
      WHEN 'quarterly' THEN ROUND(s.price / 3.0, 2)
      WHEN 'yearly' THEN ROUND(s.price / 12.0, 2)
      ELSE 0
    END
  ), 0) AS estimated_monthly_total,
  COALESCE(SUM(
    CASE s.billing_cycle
      WHEN 'monthly' THEN s.price * 12.0
      WHEN 'quarterly' THEN s.price * 4.0
      WHEN 'yearly' THEN s.price
      ELSE 0
    END
  ), 0) AS estimated_yearly_total
FROM subscriptions s
WHERE s.user_id = $1
  AND s.archived_at IS NULL
  AND s.status IN ('active', 'trial')
  AND ($2::varchar IS NULL OR s.currency_code = $2)
GROUP BY s.billing_cycle, s.currency_code
ORDER BY s.currency_code ASC,
  CASE s.billing_cycle
    WHEN 'monthly' THEN 1
    WHEN 'quarterly' THEN 2
    WHEN 'yearly' THEN 3
    ELSE 4
  END ASC;
```

### DBMS Explanation
1. **Deterministic Interval Ordering:** Uses a custom `CASE` statement in the `ORDER BY` clause to order cycles logically (`monthly` $\to$ `quarterly` $\to$ `yearly`) rather than alphabetically.
2. **Filtered Counting:** `COUNT(CASE WHEN s.status = 'active' THEN 1 END)` segments active and trial subscriptions without separate subqueries.
3. **Decimal Safety:** Uses standard relational arithmetic with 2-decimal rounding.

---

## 8. Query 6: Refund Metrics & Full vs. Partial Refund Classification

### Purpose
Audits payment refund integrity, categorizing payments into fully refunded versus partially refunded transactions.

### SQL Query
```sql
WITH payment_refund_aggregates AS (
  SELECT
    p.id AS payment_id,
    p.amount AS payment_amount,
    p.currency_code,
    COALESCE(SUM(r.amount), 0) AS total_refunded
  FROM payments p
  JOIN subscriptions s ON s.id = p.subscription_id
  JOIN refunds r ON r.payment_id = p.id
  WHERE s.user_id = $1
    AND r.refund_status = 'completed'
    AND p.payment_status = 'completed'
    AND ($2::date IS NULL OR r.refund_date >= $2)
    AND ($3::date IS NULL OR r.refund_date <= $3)
    AND ($4::varchar IS NULL OR p.currency_code = $4)
  GROUP BY p.id, p.amount, p.currency_code
)
SELECT
  currency_code,
  COUNT(*)::int AS refunded_payment_count,
  COUNT(CASE WHEN total_refunded >= payment_amount THEN 1 END)::int AS fully_refunded_count,
  COUNT(CASE WHEN total_refunded < payment_amount THEN 1 END)::int AS partially_refunded_count,
  COALESCE(SUM(total_refunded), 0) AS total_refund_amount
FROM payment_refund_aggregates
GROUP BY currency_code
ORDER BY currency_code ASC;
```

### DBMS Explanation
1. **Two-Level Aggregation:** The inner query aggregates multiple partial refunds per payment; the outer query aggregates across all payments in the tenant's account.
2. **Threshold Invariant:** Verifies `total_refunded >= payment_amount` to classify fully refunded payments. (By Stage 6 row-level lock invariants, `total_refunded` can never exceed `payment_amount`).

---

## 9. Performance & Index Optimization Considerations

The analytics queries are optimized by the existing Stage 3 and Stage 6 relational B-Tree indexes:

1. **`idx_subscriptions_user_status (user_id, status)`**: Accelerates tenant ownership filtering and active/trial subscription scans.
2. **`idx_payments_completed_date (payment_date, currency_code) WHERE payment_status = 'completed'`**: Partial index targeting only completed payments within calendar windows.
3. **`idx_refunds_payment_date (payment_id, refund_date DESC)`**: Accelerates payment-to-refund lookups and refund event date filtering.
4. **`idx_payments_subscription_date (subscription_id, payment_date DESC)`**: Accelerates subscription-level payment aggregation.

These indexes ensure that all aggregate queries execute with index scans and sequential aggregate plans rather than unindexed cross-tenant full table scans.
