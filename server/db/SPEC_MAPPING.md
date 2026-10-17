# Review 1 spec → implementation map

How every name in the Review 1 design document maps to the PostgreSQL schema and to the code
that uses it. PostgreSQL folds unquoted identifiers to lower case, so spec names appear in
`snake_case`. Schema changes live in `server/db/migrations/006`–`009`; `001`–`005` are the
original history and are never edited.

## Tables and columns

| Spec                                                    | Physical                                                                  | Notes                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **USERS**                                               | `users`                                                                   |                                                                                                            |
| User_ID INT PK                                          | `user_id INTEGER GENERATED ALWAYS AS IDENTITY`                            |                                                                                                            |
| Name VARCHAR(100) NOT NULL                              | `name VARCHAR(100) NOT NULL`                                              | API field `name`                                                                                           |
| Email VARCHAR(150) UNIQUE NOT NULL                      | `email VARCHAR(150) NOT NULL` + `uq_users_email_ci` on `lower(email)`     | case-insensitive uniqueness                                                                                |
| Password_Hash VARCHAR(255) NOT NULL                     | `password_hash VARCHAR(255) NOT NULL`                                     | bcrypt; never returned by the API                                                                          |
| Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP          | `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`                        | time-zone aware                                                                                            |
| **CATEGORY**                                            | `category`                                                                |                                                                                                            |
| Category_ID INT PK                                      | `category_id INTEGER` identity                                            |                                                                                                            |
| Category_Name VARCHAR(50) UNIQUE NOT NULL               | `category_name VARCHAR(50) NOT NULL` + `uq_category_name_ci`              | seed: `server/db/seeds/catalog.js` (incl. Entertainment, Productivity, Fitness, Utilities)                 |
| **SUBSCRIPTION**                                        | `subscription`                                                            |                                                                                                            |
| Subscription_ID INT PK                                  | `subscription_id INTEGER` identity                                        |                                                                                                            |
| User_ID FK NOT NULL                                     | `user_id` → `users` ON DELETE RESTRICT                                    |                                                                                                            |
| Category_ID FK NOT NULL                                 | `category_id` → `category` ON DELETE RESTRICT                             |                                                                                                            |
| Service_Name VARCHAR(100) NOT NULL                      | `service_name VARCHAR(100) NOT NULL`                                      | stored directly; `services` is only an autocomplete list                                                   |
| Cost DECIMAL(8,2) CHECK (Cost > 0)                      | `cost NUMERIC(8,2)` + `chk_subscription_cost CHECK (cost > 0)`            |                                                                                                            |
| Billing_Cycle {Monthly, Yearly}                         | `billing_cycle billing_cycle_type` (ENUM `Monthly`,`Yearly`)              |                                                                                                            |
| Start_Date DATE NOT NULL                                | `start_date DATE NOT NULL`                                                |                                                                                                            |
| Renewal_Date DATE NOT NULL                              | `renewal_date DATE NOT NULL`, `CHECK (renewal_date >= start_date)`        | kept when cancelled                                                                                        |
| Last_Used_Date DATE NULL                                | `last_used_date DATE`                                                     | set by `PATCH /subscriptions/:id/used`                                                                     |
| Status {Active, Cancelled} DEFAULT 'Active'             | `status subscription_status` (ENUM) DEFAULT `'Active'`                    |                                                                                                            |
| **PAYMENT_HISTORY**                                     | `payment_history`                                                         |                                                                                                            |
| Payment_ID INT PK                                       | `payment_id INTEGER` identity                                             |                                                                                                            |
| Subscription_ID FK NOT NULL                             | `subscription_id` → `subscription` ON DELETE CASCADE                      | plus composite FK `(subscription_id, currency_code)` so a payment is always in its subscription's currency |
| Amount DECIMAL(8,2) CHECK (Amount > 0)                  | `amount NUMERIC(8,2)` + `chk_payment_history_amount`                      |                                                                                                            |
| Payment_Date DATE NOT NULL                              | `payment_date DATE NOT NULL`                                              |                                                                                                            |
| **RECOMMENDATION**                                      | `recommendation`                                                          |                                                                                                            |
| Recommendation_ID INT PK                                | `recommendation_id INTEGER` identity                                      |                                                                                                            |
| User_ID FK NOT NULL                                     | `user_id` → `users` ON DELETE RESTRICT                                    |                                                                                                            |
| Subscription_ID FK NULL                                 | `subscription_id` → `subscription` ON DELETE SET NULL (`subscription_id`) | composite with `user_id`, so it can only point at the owner's subscription                                 |
| Recommendation_Text VARCHAR(255) NOT NULL               | `recommendation_text VARCHAR(255) NOT NULL`                               |                                                                                                            |
| Potential_Savings DECIMAL(8,2) NOT NULL CHECK (>= 0)    | `potential_savings NUMERIC(8,2) NOT NULL DEFAULT 0` + CHECK               |                                                                                                            |
| Generated_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP      | `generated_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`                    |                                                                                                            |
| Status {Pending, Reviewed, Dismissed} DEFAULT 'Pending' | `status recommendation_status` (ENUM) DEFAULT `'Pending'`                 |                                                                                                            |
| _(no REMINDER table)_                                   | —                                                                         | reminders are derived by `renewal_reminders` / `renewal_reminders_within`                                  |

Extra columns that do not contradict the spec (for example `currency_code`, `plan_name`,
`notes`, `archived_at`, payment status and refunds) are kept and documented in
`docs/DATABASE_SCHEMA.md`.

## Database objects

| Spec                                                     | Object                                                                                                            | Defined in                                   | Used by                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| View RenewalReminders (7 days)                           | `renewal_reminders`                                                                                               | `007_spec_db_objects.sql`                    | DB tests; global 7-day scans                                                                         |
| FR7 "within N days"                                      | function `renewal_reminders_within(user_id, days, today)`                                                         | `007`                                        | `billingRepository.getUpcomingRenewals` → `GET /billing/upcoming`, `/billing/overview`, `/dashboard` |
| View MonthlySpendByCategory                              | `monthly_spend_by_category` (joins SUBSCRIPTION + CATEGORY + USERS)                                               | `007`                                        | `analyticsRepository` overview, trends, categories                                                   |
| Trigger on PAYMENT_HISTORY (AFTER INSERT → Renewal_Date) | `trg_payment_history_update_renewal` → `spendwise_advance_renewal_date()`                                         | `007`, lock fix in `009`                     | every payment insert (`POST /subscriptions/:id/payments`, cancel with final payment)                 |
| Stored procedure GenerateRecommendations(User_ID)        | `generate_recommendations(p_user_id)` (rules 1–3)                                                                 | `007`                                        | `recommendationRepository.generate` → `POST /recommendations/generate`                               |
| Index SUBSCRIPTION(User_ID)                              | `idx_subscription_user_status (user_id, status)`, `uq_subscription_user_id_id`                                    | `001`/`006`                                  | per-user queries                                                                                     |
| Index SUBSCRIPTION(Renewal_Date)                         | `idx_subscription_renewal_date` (partial, Active) and `idx_subscription_upcoming_renewal (user_id, renewal_date)` | `007`, `006`                                 | reminder view/function                                                                               |
| Transaction: cancel = status + final payment             | `subscriptionService.cancelSubscription` (`SELECT … FOR UPDATE`, update, insert in one `withTransaction`)         | `server/src/services/subscriptionService.js` | `POST /subscriptions/:id/cancel`                                                                     |
| Yearly → monthly normalisation (single definition)       | `spendwise_monthly_equivalent(cost, cycle)`                                                                       | `007`                                        | `active_subscription_commitments`, procedure, subscription and billing queries                       |
| Change history (FR10)                                    | `trg_subscription_audit_terms` → `subscription_audit_events`                                                      | `005`/`006`                                  | `GET /subscriptions/:id/history`                                                                     |

## Recommendation rules (inside `generate_recommendations`)

| Rule                     | SQL technique                                                                                        | Potential_Savings                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1 Unused > 60 days       | subquery in `FROM` computing `CURRENT_DATE - last_used_date`; NULL = not flagged                     | monthly-equivalent cost          |
| 2 Above category average | correlated subquery: `AVG` of all other Active subscriptions in the category and currency, all users | own cost − that average          |
| 3 Duplicate category     | `GROUP BY user_id, category_id HAVING COUNT(*) > 1`; every subscription except the most expensive    | that subscription's monthly cost |

Idempotent: upsert on `(user_id, subscription_id, rule)`; Reviewed/Dismissed rows are never reset;
Pending rows whose rule stopped matching are deleted.

## DBMS concepts used in application queries

- **Joins:** `monthly_spend_by_category` (SUBSCRIPTION + CATEGORY + USERS); repositories join
  `payment_history` ⋈ `subscription` ⋈ `category`.
- **GROUP BY / HAVING:** rule 3 above; `GET /analytics/categories?minAmount=…` uses
  `HAVING SUM(total_amount) >= …` (`analyticsRepository.getCategoryAnalytics`).
- **Subqueries:** rules 1 and 2; per-payment refund totals in `paymentRepository`.
- **Views, trigger, procedure, indexes, transactions:** see the tables above.
