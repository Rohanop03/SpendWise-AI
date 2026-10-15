# DBMS Viva Preparation

## 1. Why PostgreSQL?

PostgreSQL provides exact numeric types, transactional DDL/DML, MVCC, mature constraints, partial and covering indexes, JSONB, PL/pgSQL, window functions, and strong concurrency behavior. SpendWise uses those features directly through parameterized `pg` queries instead of hiding them behind an ORM.

## 2. Why a relational database?

Subscriptions, payments, refunds, users, and services have stable relationships and strict integrity rules. Foreign keys, unique constraints, and transactions are central to preventing orphan financial rows, cross-user associations, duplicate reminders, and over-refunds.

## 3. Describe the ER model.

A user has one preferences row and many sessions, subscriptions, notifications, and recommendations. A category has many services and subscriptions. A subscription has many payments; a payment has many refunds. Recommendations and subscriptions form a many-to-many relation through `recommendation_subscriptions`. Stage 11 adds subscription audit events owned by the same user/subscription pair.

## 4. What primary and foreign keys are used?

Identity or UUID primary keys uniquely identify rows. Examples of foreign keys are `subscriptions.user_id -> users.id`, `payments.subscription_id -> subscriptions.id`, `refunds.payment_id -> payments.id`, and `auth_sessions.user_id -> users.id`.

## 5. Why composite keys and foreign keys?

Unique `(user_id, id)` pairs on owned records let dependent tables reference both owner and entity. Notifications and recommendation associations therefore cannot claim another user's subscription even if a valid subscription ID is supplied.

## 6. Which constraints protect data?

NOT NULL defines required facts; CHECK constraints validate money, dates, status values, currencies, JSON evidence, and service source; UNIQUE constraints protect email and logical event identities; foreign keys protect references. These rules apply even if application validation is bypassed.

## 7. How is the schema normalized?

Atomic columns satisfy 1NF. Relations with surrogate keys have no partial dependency, satisfying 2NF. Catalog, user, and financial facts are separated to avoid transitive dependencies, generally satisfying 3NF. Many relations also meet BCNF, while intentionally stored historical payment snapshots model event facts rather than duplication.

## 8. What are important functional dependencies?

`users.id -> email, display_name, ...`; `subscriptions.id -> user_id, service source, price, cycle, ...`; `payments.id -> subscription_id, amount, currency, date, status`; and `refunds.id -> payment_id, amount, date, status`. Candidate keys also include normalized user email and `(user_id, recommendation_key)`.

## 9. Explain ACID in SpendWise.

Atomic recommendation/association writes fully roll back on a foreign-key error. Constraints keep states consistent. MVCC, row locks, and isolation control concurrent visibility. A committed update remains visible after the transaction connection is released, demonstrating application-level durability.

## 10. Where are transactions used?

Registration creates user and preferences atomically; refresh rotates sessions; refunds lock and recheck a payment; recommendation generation locks a user and upserts a complete result; migrations apply each file and checksum atomically.

## 11. What are rollback and savepoints?

ROLLBACK discards every change since BEGIN. A SAVEPOINT marks a point inside a transaction so `ROLLBACK TO SAVEPOINT` can discard only later work. The SQL demonstrations show an optional recommendation association protected by a savepoint.

## 12. What is MVCC?

Multi-Version Concurrency Control stores row versions so readers usually do not block writers. A transaction sees versions allowed by its snapshot. Old versions are later reclaimed by VACUUM.

## 13. Explain the isolation levels demonstrated.

READ COMMITTED takes a new snapshot per statement, so a later SELECT saw another transaction's commit. REPEATABLE READ kept the same snapshot through the transaction. SERIALIZABLE detected a dangerous read/write dependency and aborted one transaction with `40001`.

## 14. What is a deadlock?

A deadlock is a wait cycle: transaction A owns row 1 and wants row 2 while B owns row 2 and wants row 1. PostgreSQL detects the cycle and aborts a victim with `40P01`; the application rolls back and may retry. Consistent lock order prevents it.

## 15. Why use row-level locking?

`SELECT ... FOR UPDATE` serializes changes to one payment while allowing unrelated payments to proceed. SpendWise rechecks refund totals after acquiring this lock, so two concurrent ₹700 refunds cannot both succeed against a ₹1,000 payment.

## 16. What is a stored function?

A function returns a scalar or relation and can appear in SQL expressions. `spendwise_monthly_equivalent` returns exact normalized cost; `spendwise_user_financial_summary` returns per-currency realized cash flow.

## 17. What is a stored procedure?

A procedure is invoked with `CALL` and performs commands. `spendwise_retire_stale_recommendations` validates inputs, updates only one user's stale active rule results, and returns an affected count through INOUT. It does not control transactions because the application owns the surrounding transaction.

## 18. What does the trigger do?

An AFTER UPDATE trigger compares OLD and NEW subscription terms and inserts an audit event only when status, price, billing cycle, or renewal date changed. Its insert rolls back with the parent update and stores no credentials or tokens.

## 19. What are the views for?

`active_subscription_commitments` standardizes recurring commitment calculations. `completed_payment_financials` pre-aggregates refunds before joining payments, avoiding double counting. They are security-invoker views and callers still filter by authenticated `user_id`.

## 20. Why indexes?

Indexes trade storage and write maintenance for faster lookup. SpendWise indexes ownership/status, dates, session validity, notification eligibility, and recommendation lifecycle fields that occur in real predicates and ordering.

## 21. Why B-tree indexes?

B-tree supports equality, range, and ordered retrieval, matching user IDs, status/date filters, and descending history. Unique B-trees also enforce identities such as recommendation keys.

## 22. How does PostgreSQL optimize queries?

The planner estimates row counts and costs from statistics, then selects scan, join, grouping, and sorting strategies. ANALYZE refreshes statistics. The cheapest estimated plan may correctly be a sequential scan on a small table.

## 23. What does EXPLAIN ANALYZE show?

EXPLAIN shows the chosen plan; ANALYZE executes it and adds actual rows/timing. BUFFERS reports cache and I/O activity. FORMAT JSON makes results machine-readable. Stage 11 measured seven warm samples for both index designs.

## 24. Which joins are used?

INNER JOIN requires relationships such as payment-to-subscription. LEFT JOIN preserves custom subscriptions without a catalog service and currencies with no refunds. A self join detects same-category subscription pairs.

## 25. Why CTEs?

CTEs name logical steps. Analytics first aggregates payments and refunds independently, then joins totals; this makes double-counting prevention explicit and reviewable.

## 26. What are window functions?

They calculate across related rows without collapsing them. SpendWise examples use `ROW_NUMBER`, `DENSE_RANK`, and `COUNT(*) OVER()` for rankings and pagination metadata.

## 27. How is payment/refund integrity protected?

Exact NUMERIC and uppercase currency constraints preserve values. Refund creation runs in a transaction, locks the payment, verifies ownership/status, sums completed refunds, and rejects an excessive new total.

## 28. How are duplicate notifications prevented?

Eligibility uses indexed user-local target dates. A unique event identity plus `INSERT ... ON CONFLICT` makes repeated or concurrent worker passes idempotent.

## 29. How are recommendations idempotent?

Stable `(user_id, recommendation_key)` uniqueness, upserts, and a per-user generation lock prevent duplicate logical results. The Stage 11 procedure retires only stale active keys for the same rule version.

## 30. How is financial precision handled?

Money uses NUMERIC, never binary floating point. Currency totals are never combined across codes. Monthly normalization rounds only the returned value to two decimals, and payment/refund aggregates are separated before joining.

## 31. How is SQL injection prevented?

Runtime values are passed as `$1`, `$2`, and so on through `pg`. Dynamic sort fields are selected from application allowlists. There is no arbitrary SQL endpoint and credentials are not interpolated into logs.

## 32. How is database security handled?

An application role uses environment-provided credentials. Ownership predicates and composite foreign keys enforce tenant boundaries; routines use invoker rights and public execution is revoked. RLS was not enabled because the shared pool does not yet safely propagate request identity.

## 33. How is PostgreSQL integration tested?

Tests verify the database name is exactly `spendwise_test`, rebuild only that schema where required, run real migrations, and test constraints, APIs, locks, concurrent requests, functions, procedures, triggers, views, and indexes. Stage 11 also runs deterministic isolation/deadlock demonstrations and a self-cleaning 50,000-row benchmark.
