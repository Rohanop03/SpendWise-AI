# Database Schema Reference

The physical schema is defined by [`server/db/migrations/001_initial_schema.sql`](../server/db/migrations/001_initial_schema.sql). It uses PostgreSQL-generated `BIGINT` identity keys, fixed-precision `NUMERIC(12,2)` money, `DATE` for billing calendar dates, and `TIMESTAMPTZ` for events. All runtime values are supplied through parameterized queries.

## `users`

Stores account identity for Stage 4. It never stores plaintext passwords.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `display_name` | `VARCHAR(100)` | not null | Trimmed length 1–100 |
| `email` | `VARCHAR(320)` | not null | Trimmed, email-shaped; unique on `lower(email)` |
| `password_hash` | `VARCHAR(255)` | not null | Length 30–255 |
| `account_status` | `VARCHAR(20)` | `active` | `active` or `disabled` |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | current timestamp | Record timestamps |

Index: `uq_users_email_ci` uniquely indexes `lower(email)` for case-insensitive login identity.

## `user_preferences`

Stores one settings row per user. Its primary key is also a foreign key to `users(id)` with `ON DELETE CASCADE`; this is the only dependent row intentionally removed with a user.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `user_id` | `BIGINT` | not null | Primary key; user foreign key |
| `preferred_currency` | `VARCHAR(3)` | `USD` | Three uppercase letters |
| `timezone` | `VARCHAR(100)` | `UTC` | Trimmed length 1–100 |
| `notifications_enabled` | `BOOLEAN` | `true` | Master in-app preference |
| `renewal_reminders_enabled` | `BOOLEAN` | `true` | Renewal preference |
| `renewal_reminder_days` | `SMALLINT` | `7` | 0–365 |
| `trial_reminders_enabled` | `BOOLEAN` | `true` | Trial preference |
| `trial_reminder_days` | `SMALLINT` | `3` | 0–365 |
| `updated_at` | `TIMESTAMPTZ` | current timestamp | Last application update |

## `auth_sessions`

Stores active rotating refresh sessions for Stage 4 authentication. Created in migration [`server/db/migrations/002_auth_sessions.sql`](../server/db/migrations/002_auth_sessions.sql). Never stores plaintext refresh tokens; stores only SHA-256 digests.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `BIGINT` | not null | References `users(id)` with `ON DELETE RESTRICT` |
| `refresh_token_hash` | `CHAR(64)` | not null | SHA-256 hex string; unique |
| `expires_at` | `TIMESTAMPTZ` | not null | Must be greater than `created_at` |
| `revoked_at` | `TIMESTAMPTZ` | nullable | Must be greater than or equal to `created_at` when present |
| `created_at` | `TIMESTAMPTZ` | current timestamp | Session creation instant |
| `last_rotated_at` | `TIMESTAMPTZ` | current timestamp | Last refresh token rotation instant |

Indexes:
- `idx_auth_sessions_user_active`: `(user_id, expires_at) WHERE revoked_at IS NULL` for active session lookups.
- `idx_auth_sessions_expiry`: `(expires_at) WHERE revoked_at IS NULL` for cleanup evaluation.

## `categories`


Shared reporting catalog. Names are unique regardless of case.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `name` | `VARCHAR(80)` | not null | Trimmed length 1–80; unique on `lower(name)` |
| `description` | `TEXT` | nullable | At most 1,000 characters |
| `created_at` | `TIMESTAMPTZ` | current timestamp | Creation event |

Index: `uq_categories_name_ci`.

## `services`

Shared provider catalog. It stores no invented prices; price is a user's subscription fact.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `name` | `VARCHAR(120)` | not null | Trimmed length 1–120; unique on `lower(name)` |
| `default_category_id` | `BIGINT` | nullable | FK to `categories(id)`, `ON DELETE SET NULL` |
| `website_url` | `TEXT` | nullable | HTTP(S), no whitespace |
| `is_active` | `BOOLEAN` | `true` | Catalog availability |
| `created_at` | `TIMESTAMPTZ` | current timestamp | Creation event |

Indexes: case-insensitive unique service name and `default_category_id` lookup.

## `subscriptions`

Stores current terms and lifecycle for each user-owned subscription. Cancellation and archival are separate: cancellation describes the agreement; archival hides an otherwise preserved record.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `user_id` | `BIGINT` | not null | FK to `users`, `ON DELETE RESTRICT` |
| `service_id` | `BIGINT` | nullable | FK to `services`, `ON DELETE RESTRICT` |
| `custom_service_name` | `VARCHAR(120)` | nullable | Required only when `service_id` is absent |
| `category_id` | `BIGINT` | not null | FK to `categories`, `ON DELETE RESTRICT` |
| `plan_name` | `VARCHAR(120)` | nullable | Trimmed length 1–120 when present |
| `price` | `NUMERIC(12,2)` | not null | Nonnegative current price |
| `currency_code` | `VARCHAR(3)` | not null | Three uppercase letters |
| `billing_cycle` | `VARCHAR(20)` | not null | `monthly`, `quarterly`, or `yearly` |
| `status` | `VARCHAR(20)` | `active` | `trial`, `active`, `paused`, or `cancelled` |
| `start_date` | `DATE` | not null | Billing calendar date |
| `next_renewal_date` | `DATE` | nullable | At/after start; required for trial/active |
| `trial_end_date` | `DATE` | nullable | At/after start; required for trial |
| `cancelled_at` | `TIMESTAMPTZ` | nullable | Required exactly when status is cancelled |
| `archived_at` | `TIMESTAMPTZ` | nullable | Independent soft-archive event |
| `notes` | `TEXT` | nullable | At most 2,000 characters |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | current timestamp | Record timestamps |

Exactly one of `service_id` and `custom_service_name` is populated. `(user_id,id)` is additionally unique so ownership-aware composite foreign keys can reference it. Multiple legitimate subscriptions to the same service remain allowed.

Indexes support user/status lists, category and service joins, and non-archived upcoming renewal scans.

## `payments`

Stores manually recorded payment events. Projected renewals are not inserted as payments. Only `completed` rows represent realized gross spending.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `subscription_id` | `BIGINT` | not null | FK to `subscriptions`, `ON DELETE RESTRICT` |
| `amount` | `NUMERIC(12,2)` | not null | Greater than zero |
| `currency_code` | `VARCHAR(3)` | not null | Historical currency snapshot |
| `payment_date` | `DATE` | not null | Payment calendar date |
| `payment_status` | `VARCHAR(20)` | not null | `pending`, `completed`, `failed`, or `cancelled` |
| `billing_period_start`, `billing_period_end` | `DATE` | nullable pair | Both absent or both present; end is not before start |
| `notes` | `TEXT` | nullable | At most 2,000 characters |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | current timestamp | Record timestamps |

Indexes support per-subscription history and completed-payment date/currency reports.

## `refunds`

Separately records partial or multiple refund events without overwriting payment history. Only completed refunds reduce realized net spending.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `payment_id` | `BIGINT` | not null | FK to `payments`, `ON DELETE RESTRICT` |
| `amount` | `NUMERIC(12,2)` | not null | Greater than zero |
| `refund_date` | `DATE` | not null | Refund calendar date |
| `refund_status` | `VARCHAR(20)` | `completed` | `pending`, `completed`, `failed`, or `cancelled` |
| `reason` | `VARCHAR(500)` | nullable | Trimmed length 1–500 when present |
| `created_at` | `TIMESTAMPTZ` | current timestamp | Creation event |

Index: payment and newest refund date. The cross-row rule that completed refunds must not exceed a completed payment belongs in the Stage 6 transactional service; a row-level check cannot enforce it safely.

## `notifications`

Stores in-app renewal, trial-expiration, and system notifications. Stage 9 generates reminders with an independent worker.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `user_id` | `BIGINT` | not null | FK to `users`, `ON DELETE RESTRICT` |
| `subscription_id` | `BIGINT` | nullable | Ownership-aware FK `(user_id,subscription_id)` |
| `notification_type` | `VARCHAR(30)` | not null | `renewal`, `trial_expiration`, or `system` |
| `title` | `VARCHAR(160)` | not null | Trimmed length 1–160 |
| `message` | `TEXT` | not null | Trimmed length 1–4,000 |
| `scheduled_for` | `TIMESTAMPTZ` | not null | Intended delivery event |
| `target_event_date` | `DATE` | nullable for system only | Required renewal/trial event date |
| `is_read` | `BOOLEAN` | `false` | Read state |
| `read_at` | `TIMESTAMPTZ` | nullable | Present exactly when read |
| `deduplication_key` | `VARCHAR(200)` | not null | Unique with `user_id` |
| `created_at` | `TIMESTAMPTZ` | current timestamp | Creation event |

Non-system notifications require a subscription and target date. Indexes support unread lists and pending schedule scans. Migration `003_notification_target_dates.sql` adds a partial unique index over user, subscription, type, and target date so concurrent worker processes cannot duplicate a logical reminder event.

## `recommendations`

Stores explainable future recommendation records, their evidence snapshot, rule version, optional savings estimate, and lifecycle. Stage 3 generates none.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `id` | `BIGINT` identity | not null | Primary key |
| `user_id` | `BIGINT` | not null | FK to `users`, `ON DELETE RESTRICT` |
| `recommendation_type` | `VARCHAR(40)` | not null | Supported deterministic rule type |
| `explanation` | `TEXT` | not null | Trimmed length 1–4,000 |
| `evidence` | `JSONB` | `{}` | Must be a JSON object |
| `rule_version` | `VARCHAR(40)` | not null | Trimmed length 1–40 |
| `estimated_savings` | `NUMERIC(12,2)` | nullable | Nonnegative; all savings fields present together |
| `currency_code` | `VARCHAR(3)` | nullable | Uppercase code paired with estimate |
| `savings_period` | `VARCHAR(20)` | nullable | `monthly`, `yearly`, or `one_time` |
| `status` | `VARCHAR(20)` | `active` | `active`, `dismissed`, or `resolved` |
| `resolved_at` | `TIMESTAMPTZ` | nullable | Absent for active; present otherwise |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | current timestamp | Record timestamps |

`(user_id,id)` is unique for ownership-aware links. Index: user, status, and newest creation time.

## `recommendation_subscriptions`

Associative table allowing one recommendation to explain a comparison across several subscriptions.

| Column | Type | Null/default | Rules |
| --- | --- | --- | --- |
| `recommendation_id` | `BIGINT` | not null | Composite primary key; ownership-aware recommendation FK |
| `subscription_id` | `BIGINT` | not null | Composite primary key; ownership-aware subscription FK |
| `user_id` | `BIGINT` | not null | Enforces the same owner on both references |
| `relationship_role` | `VARCHAR(20)` | `subject` | `subject` or `comparison` |

Deleting a recommendation cascades only its associative rows. Deleting a referenced subscription remains restricted. Index: reverse lookup by subscription.

## `schema_migrations`

Created by the migration runner before domain migrations. `migration_id VARCHAR(255)` is the primary key, `checksum VARCHAR(64)` detects changed applied files, and `applied_at TIMESTAMPTZ` records application time. It is intentionally absent from migration SQL so a fresh runner can bootstrap tracking.

## Referential-action policy

- Financial history and user-owned domain rows use `RESTRICT`; application workflows archive instead of physically deleting subscriptions.
- A category removed from a service default uses `SET NULL`, but categories referenced by subscriptions cannot be removed.
- Preferences cascade with their identity owner because they have no independent history.
- Recommendation link rows cascade with a removed recommendation; the recommendation itself does not own subscriptions.
- Account closure and legally required data erasure need an explicit, audited Stage 4+ workflow. Foreign keys do not substitute for API authorization.

No row-level security is enabled in Stage 3. Future repositories must derive the owner from authenticated identity and include `user_id` in every user-owned query. Composite foreign keys reinforce internal ownership consistency but cannot authenticate callers.
