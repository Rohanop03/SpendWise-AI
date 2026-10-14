# Preliminary Database Planning

## 1. Purpose and Boundaries

This document identifies likely entities, relationships, integrity concerns, and meaningful DBMS use cases. It is a conceptual model only.

Stage 1 does **not** define physical table names, columns, PostgreSQL data types, migrations, SQL statements, seed data, or final cardinality edge cases. Detailed entity-relationship modeling, functional dependencies, normalization, constraints, and deletion behavior belong to Stage 3.

## 2. Conceptual Relationship Summary

- A user owns many user subscriptions, payments through those subscriptions, notifications, and recommendations.
- A user has one active preference set.
- A subscription service can be referenced by many user subscriptions.
- A subscription category can classify many services or user subscriptions, subject to the Stage 3 decision on whether category belongs to the service catalog, the user's subscription, or both.
- A user subscription belongs to one user and refers to one service and one category at a point in time.
- A user subscription can have many payments, notifications, and recommendation references.
- A recommendation may concern one or multiple user subscriptions, suggesting an associative relationship may be required.

## 3. Candidate Entities

### 3.1 Users

**Purpose:** represent an authenticated account and the root owner of private application data.

**Important conceptual attributes:**

- Stable user identifier
- Display name
- Normalized unique email
- Password hash
- Account status
- Created and updated timestamps

**Relationships:**

- One user owns many user subscriptions.
- One user has one preference set.
- One user receives many notifications and recommendations.
- Payments are isolated through ownership of their related subscription; direct ownership may also be stored only if Stage 3 proves it necessary and non-redundant.

**Relevant DBMS concepts:** primary key, unique normalized email, non-null constraints, transactionally created defaults, indexed login lookup, privacy-aware deletion/restriction policy.

### 3.2 Subscription Services

**Purpose:** represent the recognizable service or provider, such as a streaming or cloud-storage offering, separately from a specific user's price and renewal schedule.

**Important conceptual attributes:**

- Stable service identifier
- Canonical or display name
- Optional provider metadata such as website or icon reference
- Active/availability indicator for catalog use

**Relationships:**

- One service can be referenced by many user subscriptions.
- A service may have a default category, while a user's subscription may need a user-selected category.

**Relevant DBMS concepts:** normalization to avoid repeating service metadata, uniqueness/case-normalization decisions, shared versus user-created catalog records, joins for display and overlap analysis.

### 3.3 Subscription Categories

**Purpose:** group subscriptions into reporting and comparison domains such as entertainment, productivity, or cloud storage.

**Important conceptual attributes:**

- Stable category identifier
- Unique category name or slug
- Optional description
- Optional status/order metadata

**Relationships:**

- One category classifies many services or user subscriptions.
- Category totals aggregate user subscriptions or their payments.

**Relevant DBMS concepts:** lookup-table normalization, uniqueness, foreign keys, `GROUP BY` reporting, `HAVING` for threshold-based category analysis.

### 3.4 User Subscriptions

**Purpose:** represent a user's recurring agreement with a service and its current scheduling/price terms.

**Important conceptual attributes:**

- Stable user-subscription identifier
- Owning user reference
- Service reference
- Category reference if classification is user-specific
- Current price and ISO currency code
- Billing cycle: monthly, quarterly, or yearly initially
- Start date, next renewal date, and optional trial end date
- Lifecycle status: active, paused, trial, or cancelled
- Optional user notes
- Created and updated timestamps

**Relationships:**

- Belongs to one user, one service, and one category under the selected Stage 3 model.
- Has zero or many payments and notifications.
- May participate in zero or many recommendations.

**Relevant DBMS concepts:** foreign keys, ownership indexes, fixed-precision monetary values, status/cycle checks, date validation, composite indexes for user plus status/renewal date, transaction-safe updates, reporting joins.

### 3.5 Payments

**Purpose:** record historical or explicitly tracked billing events without conflating an expected renewal with a completed payment.

**Important conceptual attributes:**

- Stable payment identifier
- Related user-subscription reference
- Recorded amount and currency
- Billing/payment date
- Status such as expected, completed, failed, or refunded, subject to final modeling
- Optional note or external reference entered by the user
- Created and updated timestamps

**Relationships:**

- Belongs to one user subscription.
- Is visible only through the owning user's authorization scope.

**Relevant DBMS concepts:** immutable historical facts where appropriate, fixed-precision amounts, status constraints, date indexes, aggregate historical reports, transaction coupling when schedule advancement must be atomic, audit strategy.

The final model must decide whether expected occurrences belong in the payment table or are computed from subscription schedules. The preferred starting assumption is to compute upcoming payments from schedules and reserve stored payment rows for explicit events, preventing accidental completed-payment creation.

### 3.6 Notifications

**Purpose:** store in-app messages about upcoming renewals, trial expirations, and other supported events.

**Important conceptual attributes:**

- Stable notification identifier
- Recipient user reference
- Optional related user-subscription reference
- Notification type
- Title and message or structured payload
- Due/occurrence date
- Read state and read timestamp
- Created timestamp
- Deduplication key or equivalent occurrence identity

**Relationships:**

- Belongs to one user.
- May relate to one user subscription.

**Relevant DBMS concepts:** composite uniqueness for scheduler idempotency, user/read/date indexes, defaults, nullable relationship where justified, scheduled queries, transactional creation.

### 3.7 AI Recommendations

**Purpose:** persist explainable optimization suggestions and their lifecycle, while retaining the facts and rule that generated them.

**Important conceptual attributes:**

- Stable recommendation identifier
- Owning user reference
- Rule/recommendation type
- Explanation and structured evidence
- Estimated savings amount, currency, and period when applicable
- Status such as active, dismissed, or resolved
- Generated, updated, dismissed, and expiry timestamps as needed
- Rule version for reproducibility

**Relationships:**

- Belongs to one user.
- May reference one or several user subscriptions through an associative entity.

**Relevant DBMS concepts:** one-to-many ownership, possible many-to-many recommendation-subscription relation, check constraints, JSON versus normalized evidence tradeoff, subqueries and aggregates for rule inputs, deduplication/versioning.

The term “AI” does not imply untraceable output. Baseline recommendations come from documented deterministic rules; an optional LLM may only explain validated facts.

### 3.8 User Preferences

**Purpose:** store per-user settings without adding preference columns to the core user identity record.

**Important conceptual attributes:**

- User reference as a unique owner
- Preferred display currency
- Time zone
- Renewal-reminder enabled flag and lead days
- Trial-reminder enabled flag and lead days
- Other presentation/notification settings added only when required
- Updated timestamp

**Relationships:**

- Exactly one active preference set belongs to one user.

**Relevant DBMS concepts:** one-to-one relationship, unique foreign key, defaults, range/check constraints, transactional default creation.

## 4. Potential Associative and Supporting Entities

Stage 3 should evaluate these only if requirements justify them:

- **Recommendation subscriptions:** connects a recommendation to one or more user subscriptions and records each record's role in the comparison.
- **Subscription price history:** records effective-dated current-term changes if payment history alone is insufficient for historical scheduled-price analysis.
- **Audit events:** records selected security or material data changes; should be scoped to avoid unnecessary personal-data duplication.
- **Refresh sessions/tokens:** supports revocation and device/session management if the Stage 4 authentication design uses refresh credentials.

These are candidates, not approved Stage 1 tables.

## 5. Preliminary Normalization Considerations

The Stage 3 schema should aim for 3NF where appropriate:

- User identity, service metadata, category metadata, subscription terms, payments, and preferences represent distinct facts.
- Service/category names should not be copied into every payment row merely for convenience.
- Payment amount and currency remain on the payment because they are facts of that historical event, not derivable safely from the current subscription price.
- Estimated monthly/yearly costs should normally be calculated rather than stored, avoiding update anomalies.
- Recommendation evidence may require a hybrid model; frequently queried relational facts should remain normalized, while a constrained snapshot may support traceability.
- Any stored derived values or deliberate denormalization require a documented consistency strategy and measured query benefit.

## 6. Meaningful DBMS Feature Use Cases

| DBMS concept | Planned use case |
| --- | --- |
| Primary and foreign keys | Identify entities and prevent orphan subscriptions, payments, notifications, and recommendation links. |
| `NOT NULL`, `UNIQUE`, `CHECK`, `DEFAULT` | Enforce required identity, unique email/category values, valid price/status/cycle ranges, and safe preference/read defaults. |
| CRUD | Manage user subscriptions, payments, preferences, notification state, and recommendation state. |
| `INNER JOIN` | Combine subscriptions with required service/category data for owned lists and reports. |
| `LEFT JOIN` | Include subscriptions with no payment history in inventory or expected-cost reports. |
| Aggregates and `GROUP BY` | Produce totals by user, category, currency, time period, and payment status. |
| `HAVING` | Select categories or service groups that cross a documented concentration/count threshold. |
| Subqueries/CTEs | Compare a subscription to the user's/category's average or isolate latest relevant payment facts. |
| Views | Provide reusable, user-scope-ready normalized expense and payment-summary projections. |
| Indexes | Support email login, ownership filters, status filters, renewal windows, payment periods, and notification unread queries. |
| Transactions | Atomically create account defaults or record a payment together with an agreed renewal-schedule update. |
| ACID properties | Prevent partial financial-history/schedule changes and preserve concurrent consistency. |
| Triggers | Maintain a narrowly scoped audit timestamp/history or enforce a cross-row invariant only when a constraint/function is insufficient. |
| Stored functions/procedures | Centralize a well-justified report or atomic domain operation used from multiple paths. |
| `EXPLAIN ANALYZE` | Measure reporting queries and validate that indexes improve real access paths. |

Triggers and stored routines will not be added merely to satisfy a checklist. Each must have a requirement, tests, and a clear reason it belongs in PostgreSQL instead of application code.

## 7. Integrity and Consistency Questions for Stage 3

1. Should deleting a subscription be restricted when payments exist, implemented as archival/soft deletion, or allow a controlled cascade? The preliminary preference is preservation of financial history.
2. Can users create private service/category values, or is there one curated shared catalog?
3. Is category attached to the service, the user subscription, or both with a default/override rule?
4. Are expected payments computed only, stored as scheduled occurrences, or modeled with a distinct entity?
5. Which payment states count as realized spending, and how do refunds affect aggregates?
6. How are changes to price, currency, billing cycle, and renewal schedule audited?
7. Which dates are calendar dates and which events require time-zone-aware timestamps?
8. What is the retention/deletion behavior when a user closes an account?
9. How should concurrent scheduler and user actions avoid duplicate notifications or schedule updates?
10. Which recommendation evidence should be relational versus a versioned snapshot?

## 8. Preliminary Query and Index Strategy

Likely high-value access patterns include:

- Find a user by normalized email during login.
- List a user's subscriptions by status, category, service name, or renewal date.
- Find qualifying renewals within a date window for enabled users.
- Sum realized payments by user, currency, category, and date period.
- List unread notifications by user in recent-first order.
- Find active recommendations and their related subscriptions.

Candidate indexes must be derived from final query predicates and validated with representative data and `EXPLAIN ANALYZE`. Redundant indexes should be avoided because they increase storage and write cost.

## 9. Data Isolation Principle

Application queries must derive the owner from authenticated identity and scope every user-owned access accordingly. Foreign keys preserve structural integrity, while API authorization and user-scoped SQL prevent horizontal data access. Stage 3 should consider composite relationships or other database-level reinforcement where it improves isolation without unnecessary duplication.
