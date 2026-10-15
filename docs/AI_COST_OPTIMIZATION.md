# AI-Powered Cost Optimization

## Stage 10 overview

Stage 10 adds an authenticated, explainable Recommendation Center backed by PostgreSQL. The deterministic rules engine is authoritative. It reads only the authenticated user's current subscription records and completed payment/refund history, persists evidence, and never performs provider actions.

## Architecture

`POST /api/v1/recommendations/generate` opens a transaction, locks the authenticated user's row, loads bounded source data, runs rule version `stage10-v1`, upserts stable recommendation identities, synchronizes subscription relationships, and marks unmatched active rows inactive. The user-row lock serializes generation per account; `(user_id,recommendation_key)` is the final concurrency guard.

The React Recommendation Center lists current and historical results. The dashboard reads a compact summary. Stage 9 reminders remain independent events and are never created by this engine.

## Deterministic rule catalog

| Rule | Condition | Priority | Confidence | Numeric saving |
| --- | --- | --- | --- | --- |
| Exact duplicate | At least two active/trial, unarchived subscriptions share a catalog service or conservatively normalized custom name and currency | High | High for catalog; medium for custom name | Lowest normalized monthly commitment in the group |
| Category overlap | At least three eligible subscriptions share category and currency | Low | Low | None |
| High recurring cost | Portfolio has at least two subscriptions; item is at least 35% of its currency's monthly run-rate | Medium; high at 50% | High | Item's normalized monthly commitment |
| Spending concentration | At least three completed payments across at least two subscriptions; one subscription is at least 40% of 12-month gross completed payments | Medium; high at 60% | High | None; historical spend is not projected savings |
| Renewal review | Eligible paid subscription renews today through 30 days ahead | Medium; high within 7 days | High | Current normalized monthly commitment |
| Trial review | Trial ends today through 14 days ahead | Medium; high within 3 days | High | None; conversion price is not assumed |
| Billing-plan review | Monthly subscription also meets the high-cost threshold | Low | Medium | None; no alternative price or discount is known |

Paused, cancelled, and archived subscriptions are ineligible for current rules. Overdue dates are excluded. Rules are capped at 100 persisted candidates per run.

## Financial definitions

Monthly normalization uses integer cents and half-up rounding: monthly `P`, quarterly `P / 3`, yearly `P / 12`. Historical concentration uses completed payments in the trailing year and separately aggregates completed refunds before calculating net cash flow. Pending, failed, and cancelled events are excluded.

All monetary outputs retain their three-letter currency. No exchange rate or cross-currency total exists. Potential savings mean a hypothetical reduction if the identified subscription is discontinued without replacement cost. The summary takes the largest supported monthly estimate per `(currency, savingsSubscriptionId)` before summing, so duplicate, cost, and renewal suggestions cannot count the same action repeatedly. Unsupported reviews have null savings fields.

## Persistence and lifecycle

Migration `004_ai_cost_optimization.sql` extends the existing `recommendations` table with title, priority, confidence, suggested action, stable key, SHA-256 source fingerprint, and evaluation time. It expands the rule types and adds `inactive` for no-longer-applicable facts. Existing rows receive safe legacy values; no row is deleted.

`recommendation_subscriptions` remains the ownership-safe association table. Its composite foreign keys prevent linking another user's recommendation or subscription.

Generation updates current facts for the same logical key. It preserves `dismissed` and `resolved` feedback. An inactive recommendation may become active when the same logical situation returns; dismissed or resolved items do not reactivate automatically. Event identities include the renewal/trial target date, so a genuinely new target date is a new situation. Stale active rows become inactive and retain history.

## API reference

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/recommendations` | Paginated owner-scoped list; filters: status, type, priority, currency; whitelisted sorting |
| `GET` | `/api/v1/recommendations/summary` | Active/high counts and deduplicated hypothetical monthly amounts by currency |
| `GET` | `/api/v1/recommendations/:id` | Owner-scoped details and related subscriptions |
| `POST` | `/api/v1/recommendations/generate` | Transactional on-demand analysis and summary |
| `PATCH` | `/api/v1/recommendations/:id` | Set active, dismissed, or resolved/addressed status |
| `POST` | `/api/v1/recommendations/:id/explain` | Deterministic explanation or safe optional-provider output |

Every endpoint requires a live authenticated session. IDs, bodies, queries, and sort values are validated. An ID belonging to another user returns the same 404 as an absent ID.

## Frontend

The protected `/recommendations` page provides generation, loading/error/empty states, status and currency filters, priority/confidence labels, exact supported savings, evidence limitations, related-subscription links, dismissal, addressed status, and explanation fallback. The dashboard shows active and high-priority counts, up to two previews, and only deduplicated supported monetary opportunities.

## Optional explanation adapter

The adapter is provider-neutral and disabled in the application configuration. No external provider, API key, SDK, or live call is included in Stage 10. When disabled, unavailable, timed out, failed, or invalid, it returns deterministic stored facts. A future injected provider receives a minimal allowlisted facts object, a 4-second requested timeout, and a 1,200-character limit. User-written notes and an arbitrary user prompt are never sent. Provider text cannot alter persisted facts or monetary fields.

## Privacy and security

Analysis is scoped by authenticated `user_id`; SQL is parameterized. Provider actions, cancellation, usage claims, discounts, currency conversion, and guaranteed/realized savings are prohibited. The recommendation generator does not create notifications or mutate subscriptions, payments, or refunds.

## PostgreSQL techniques

The repository uses CTEs, joins, grouping, sums, cases, composite foreign keys, a partial source-data window, a unique logical identity, row locking, transactions, and conflict upserts. Payment and refund aggregates are separated before joining to avoid multiplying payment amounts.

## Testing

Pure tests cover normalization, duplicate/custom matching, eligibility, currency isolation, historical concentration, unsupported amounts, provider success/failure, and fallback. PostgreSQL integration tests cover authentication, concurrency, idempotency, relationship persistence, updated facts, dismissal preservation, stale retirement, validation, and ownership. Frontend tests cover rendering, generation, explanations, actions, filters, and empty/error behavior.

## Known limitations and Stage 11 readiness

SpendWise has no verified usage telemetry, external provider pricing, cancellation API, exchange rates, or confirmed realized-savings ledger. Category overlap is therefore deliberately low-confidence, and billing-plan review makes no price claim. Analysis is on demand rather than scheduled.

Stage 11 can measure the real list, source-input, upsert, and summary queries; inspect the two recommendation indexes; and demonstrate transaction isolation and constraints. Stage 10 intentionally adds no triggers, stored procedures, materialized views, or deployment infrastructure.
