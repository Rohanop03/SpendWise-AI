# Advanced DBMS Implementation

## Scope

Stage 11 adds database-native calculation, controlled procedural maintenance, auditing, reusable read models, transaction demonstrations, and measured indexing. Migration `005_advanced_dbms.sql` is additive. It does not rewrite migrations 001–004 or reset development data.

## Architecture and integrity

SpendWise AI has thirteen application and infrastructure tables after Stage 11. `users` owns preferences, sessions, subscriptions, notifications, and recommendations. A subscription belongs to a category and either a catalog service or a custom service name. Payments preserve historical amount and currency snapshots; refunds belong to payments. Recommendation and notification ownership is reinforced by composite foreign keys. `subscription_audit_events` belongs to the same `(user_id, subscription_id)` pair as its subscription.

Every entity uses a primary key. Important alternate keys include case-insensitive user email, `(user_id, id)` ownership keys, notification deduplication identities, and `(user_id, recommendation_key)`. CHECK constraints bound enumerations, positive money, dates, JSON evidence, recommendation state, and service-source exclusivity. Foreign keys reject orphan payments, refunds, sessions, and cross-user associations. Historical financial rows are never cascaded away by normal application behavior; subscriptions use soft archival.

## Stored functions

### `spendwise_monthly_equivalent(NUMERIC, TEXT) -> NUMERIC`

Uses exact `NUMERIC` arithmetic and rounds the result to two decimal places: monthly `P`, quarterly `P / 3`, and yearly `P / 12`. A NULL argument returns NULL. Negative amounts and unsupported cycles raise SQLSTATE `22023`. The function is `IMMUTABLE`, `PARALLEL SAFE`, and `SECURITY INVOKER`.

```sql
SELECT spendwise_monthly_equivalent(100, 'yearly'); -- 8.33
```

### `spendwise_user_financial_summary(BIGINT, DATE, DATE)`

Returns one row per currency with completed-payment count, gross payments, completed refunds, and net cash flow. Payment and refund aggregates are computed separately before joining, preventing payment multiplication when a payment has several refunds. Optional date bounds are inclusive. It is `STABLE`, `PARALLEL SAFE`, and `SECURITY INVOKER`. Callers must pass the authenticated user's ID.

## Stored procedure

`spendwise_retire_stale_recommendations(BIGINT, VARCHAR, VARCHAR[], TIMESTAMPTZ, INOUT INTEGER)` retires active recommendations not present in the current rule output. It demonstrates PL/pgSQL variables, validation branches, a bounded UPDATE, `GET DIAGNOSTICS`, and exception handling. The Stage 10 repository calls it while retaining the existing user-row transaction lock.

A function returns a value and can participate in expressions. A procedure is invoked with `CALL` and is suited to commands. PostgreSQL procedures can perform transaction control only in eligible top-level call contexts; this procedure deliberately does not commit or roll back because the application invokes it within an existing transaction.

## Trigger and audit trail

`trg_subscriptions_audit_terms` runs after updates to status, price, billing cycle, or renewal date. `spendwise_audit_subscription_changes()` compares `OLD` and `NEW` with `IS DISTINCT FROM`, records only fields that changed, and stores only the four relevant values as JSONB. It does not capture credentials, notes, or payment data and cannot recurse because it writes a separate table.

The audit insert is part of the parent transaction. Integration tests force a rollback after an update and confirm that neither the data change nor its audit event persists. The audit foreign key uses `ON DELETE RESTRICT`; application subscriptions are archived rather than deleted.

## Views

- `active_subscription_commitments` presents non-archived active/trial subscriptions with monthly and yearly normalized commitment values.
- `completed_payment_financials` presents completed payments with pre-aggregated completed refunds and net cash flow without double counting.

Both are PostgreSQL `security_invoker` views. They intentionally include `user_id`; a view is not a tenant boundary, so application queries must still add `WHERE user_id = $1`. No public API exposes either view without authentication.

## Transactions and ACID

- **Atomicity:** the demo inserts a recommendation and then forces an invalid association. SQLSTATE `23503` rolls the entire transaction back; zero recommendation rows remain.
- **Consistency:** primary, foreign, unique, CHECK, ownership, and refund-total rules move every committed state between valid states.
- **Isolation:** independent pool clients demonstrate statement snapshots, transaction snapshots, serialization failure, row locks, and deadlock detection.
- **Durability:** a committed user update remains visible after the transaction client is returned to the pool. This verifies application-level commit visibility without deliberately crashing PostgreSQL.

The production refund path locks the payment with `SELECT ... FOR UPDATE`, rechecks the completed refund total, and inserts within one transaction. Recommendation generation locks its user row and uses unique keys/upserts. Notification generation relies on a unique event identity and `ON CONFLICT`. These mechanisms remain covered by integration tests.

## MVCC and isolation

PostgreSQL MVCC lets readers see snapshots without normally blocking writers. The `db:demo` command uses independent clients and deterministic barriers:

- Under READ COMMITTED, a second SELECT sees a concurrently committed display-name change.
- Under REPEATABLE READ, both SELECT statements see the original snapshot; a query after COMMIT sees the new value.
- Under SERIALIZABLE, two transactions read the same two-row predicate and update different rows. PostgreSQL aborts one with `40001`; an application should retry the entire transaction with a bounded policy.

All demo transactions set a 5-second lock timeout and 10-second statement timeout. The deadlock demo acquires the same two rows in opposite orders. PostgreSQL commits one transaction, aborts one with `40P01`, and releases all locks. Production code prevents this class of problem by using consistent lock order and short transactions.

## Index strategy and optimization

Existing B-tree, unique, and partial indexes cover email/session lookup, user subscription status, renewal eligibility, payment/refund history, notification scheduling/deduplication, and recommendation lifecycle queries. Stage 11 adds only:

```sql
CREATE INDEX idx_payments_completed_subscription_covering
ON payments (subscription_id, payment_date DESC, currency_code)
INCLUDE (id, amount)
WHERE payment_status = 'completed';
```

It matches completed payment aggregation and history by subscription. The partial predicate removes non-realized payments; included values allow an index-only scan. Its costs are extra storage and maintenance on completed payment inserts/updates. The measured justification is in `DATABASE_PERFORMANCE_REPORT.md`.

Sequential scans are appropriate for small tables or queries returning much of a table. Bitmap scans help when several predicates return a medium fraction. Nested loops favor selective indexed joins; hash joins favor larger equality joins; merge joins benefit ordered inputs. Query plans must be interpreted with cardinality, buffers, and data volume—not scan labels alone.

## Normalization

The operational schema is predominantly 3NF and many relations satisfy BCNF. Catalog service/category facts are not copied into subscriptions; payments intentionally snapshot amount and currency because those facts depend on the payment event, not the current subscription. Multi-valued refunds and recommendation associations are separate relations, avoiding 4NF violations. A detailed analysis is in `NORMALIZATION.md`.

## Security

Credentials remain in ignored environment files. All application values use `pg` parameters. Services and repositories include authenticated ownership predicates, while composite foreign keys block cross-user notification and recommendation links. New routines are `SECURITY INVOKER`; PUBLIC execute is revoked and execute is granted only to the migration role. Views use invoker security.

Row-Level Security was evaluated but not enabled. The shared connection pool does not currently propagate a trusted per-request PostgreSQL identity or transaction-local tenant setting. Enabling RLS now could either deny valid requests or create unsafe state leakage. Ownership predicates plus composite constraints remain the verified model; RLS is a future defense-in-depth option after connection identity propagation is designed and tested.

## Verification and test strategy

`npm run db:advanced:verify` inspects all Stage 11 objects and function output. `npm run db:demo` demonstrates ACID, isolation, serialization, and deadlock behavior. `npm run db:benchmark` creates 50,000 fictional payment rows only in `spendwise_test`, measures both plans, restores the index, and removes fixtures. Every command rejects databases not named `spendwise_test` and releases its pool.

The advanced integration suite tests routine output and errors, uneven rounding, NULLs, trigger OLD/NEW values and rollback, multi-refund correctness, the procedure, view security options, and index existence. Existing suites continue to test refund locking, notification deduplication, recommendation idempotency, ownership, migrations, authentication, and all APIs.
