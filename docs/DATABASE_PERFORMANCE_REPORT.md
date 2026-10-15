# Database Performance Report

## Environment and method

Measurements were taken on 15 October 2026 against local PostgreSQL 18.6 on Windows using the application role and `spendwise_test`. The benchmark command created 100 fictional subscriptions and 500 payments per subscription: 50,000 payment rows total, with 90% completed and 10% failed. It removed all fixtures after measurement and restored the optimized index even on failure.

The same parameter, dataset, SQL, and server were used before and after. Each phase ran one warm-up followed by seven measured `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` executions. Timings are warm-cache results; they are not production capacity claims.

## Workload

```sql
SELECT currency_code, COUNT(*) AS payment_count, SUM(amount) AS total
FROM payments
WHERE subscription_id = $1
  AND payment_status = 'completed'
  AND payment_date >= DATE '2024-01-01'
GROUP BY currency_code;
```

This represents completed payment history aggregation for one subscription. It preserves currency separation and excludes unrealized payments.

## Actual results

| Metric | Baseline | Optimized |
| --- | ---: | ---: |
| Plan access | Index Scan | Index Only Scan |
| Samples (ms) | 0.567, 0.603, 0.671, 0.558, 0.620, 0.574, 0.688 | 0.576, 0.461, 0.442, 0.457, 0.436, 0.470, 0.517 |
| Median execution | 0.603 ms | 0.461 ms |
| Mean execution | 0.612 ms | 0.480 ms |
| Planning time (reported final sample) | 0.204 ms | 0.204 ms |
| Shared hit blocks (plan root, final sample) | 15 | 6 |
| Shared read blocks | 0 | 0 |

The measured mean improved by 21.6%; the median improved by about 23.5%. Buffer hits fell from 15 to 6. The optimized plan could satisfy selected/filter/grouping values from the index, whereas the baseline index scan visited heap data. All measured blocks were already cached.

## Optimization

```sql
CREATE INDEX idx_payments_completed_subscription_covering
ON payments (subscription_id, payment_date DESC, currency_code)
INCLUDE (id, amount)
WHERE payment_status = 'completed';
```

The first key is the selective subscription predicate. Payment date supports time filtering and descending history. Currency supports grouping, while `id` and `amount` cover common completed-history projections. The partial predicate keeps failed and pending rows out of the structure.

## Broader index review

- Subscription ownership/status and upcoming-renewal partial indexes match listing and reminder workloads.
- Payment subscription/date and completed-date indexes match history and analytics.
- Refund payment/date supports refund totals and audit history.
- Notification scheduled/unread partial indexes and unique event indexes support workers and idempotency.
- Recommendation user/status/date and user/type/priority indexes support retrieval; its unique user/key constraint prevents duplicate logical recommendations.
- Session user/active/expiry indexes support refresh validation and cleanup.

No speculative index was added for every filter combination. Each extra index consumes disk, increases write cost, and adds planner choices. Small reference tables are expected to use sequential scans.

## Plan interpretation and limitations

`EXPLAIN ANALYZE` executes the SELECT and reports actual timing. `BUFFERS` showed warm shared-buffer hits, not physical I/O. Local scheduling, background activity, table visibility maps, and cache state can change sub-millisecond results. The fixture distribution is controlled rather than production-derived. The percentage is useful for this repeatable workload but should not be generalized to all analytics.

The test intentionally drops and recreates the candidate index only after verifying the connected database is exactly `spendwise_test`. It never benchmarks UPDATE or DELETE against development data.

## Reproduction

```powershell
npm run db:advanced:verify
npm run db:benchmark
```

The command prints raw samples, median, mean, node types, planning time, and buffer totals as JSON. Keep PostgreSQL version, fixture count, machine load, and query parameters stable when comparing future runs.
