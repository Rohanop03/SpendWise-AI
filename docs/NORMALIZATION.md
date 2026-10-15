# Database Normalization

## Starting point

A single subscription spreadsheet might repeat user identity, preferences, provider/category text, current terms, every payment, every refund, notifications, and recommendations on each row. That design creates insertion, update, and deletion anomalies: changing an email touches many rows, a user cannot exist without a subscription, and deleting the last payment could erase subscription facts.

The implemented design decomposes those facts into tables according to what each fact describes.

## First Normal Form (1NF)

Every column contains one value of one defined type, each row is uniquely identifiable, and repeating groups are separate rows:

- subscriptions, payments, refunds, notifications, and recommendations each have their own identity keys;
- multiple payments are rows in `payments`, not numbered payment columns on `subscriptions`;
- multiple subscriptions attached to a recommendation are rows in `recommendation_subscriptions`;
- status, currency, and date fields are scalar and constrained.

`recommendations.evidence` is a deliberate JSONB snapshot. It must be a JSON object and supports explanation traceability; authoritative relational facts remain in normalized tables. Application code must not use this JSON as a replacement for ownership, money, or subscription relationships.

## Second Normal Form (2NF)

All non-key attributes depend on the whole candidate key, not part of a composite key.

Most tables have a single-column primary key, so a partial dependency is impossible. In the two composite-key cases:

- in `recommendation_subscriptions(recommendation_id, subscription_id)`, `relationship_role` describes that exact recommendation/subscription pairing;
- `user_id` is intentionally repeated as an ownership consistency key and participates in both composite foreign keys. It is not descriptive data copied for display.

Migration metadata is keyed by `migration_id`; checksum and application time describe that migration as a whole.

## Third Normal Form (3NF)

Each non-key attribute depends on the key, the whole key, and no non-key attribute:

- user identity is in `users`; settings are in the one-to-one `user_preferences` table;
- category descriptions are in `categories`, not copied to services or subscriptions;
- service metadata is in `services`; a subscription references it or stores an explicit custom name;
- current subscription terms are in `subscriptions`; historical payment amount/currency stays on each `payments` event;
- refunds are their own events instead of a mutable refunded flag or amount on a payment;
- recommendation-to-subscription membership is separated from recommendation explanation and lifecycle.

The service's default category is only a catalog suggestion. `subscriptions.category_id` is a required user-selected classification, not a value derived from `services.default_category_id`; therefore storing both does not create a transitive dependency.

## Important functional dependencies

| Relation | Functional dependencies |
| --- | --- |
| `users` | `id → display_name, email, password_hash, account_status, timestamps`; `lower(email) → id` |
| `user_preferences` | `user_id → all preference attributes` |
| `categories` | `id → name, description, created_at`; `lower(name) → id` |
| `services` | `id → name, default_category_id, website_url, is_active, created_at`; `lower(name) → id` |
| `subscriptions` | `id → owner, provider/custom name, category, current terms, lifecycle, timestamps` |
| `payments` | `id → subscription, historical amount/currency, status, period, timestamps` |
| `refunds` | `id → payment, refund amount/date/status/reason` |
| `notifications` | `id → recipient, related subscription, content, state`; `(user_id, deduplication_key) → id` |
| `recommendations` | `id → owner, type, explanation, evidence, savings, lifecycle`; `(user_id,id)` is an ownership-aware candidate key |
| `recommendation_subscriptions` | `(recommendation_id,subscription_id) → user_id, relationship_role` |
| `subscription_audit_events` | `id → subscription_id, user_id, change_type, changed_fields, old_values, new_values, changed_at` |
| `schema_migrations` | `migration_id → checksum, applied_at` |

## Historical snapshots and calculated values

Payment amount and currency are intentionally stored even though a payment references a subscription. They describe the historical payment, while `subscriptions.price` and `currency_code` describe current future terms. Deriving history from current terms would corrupt past reporting after a price or currency change.

The schema does not persist monthly equivalents, annual projections, category totals, or net-spend totals. Those values are queries over current subscription terms or completed payment/refund events. Totals remain grouped by currency because no exchange-rate source exists.

Recommendation evidence is a versioned explanation snapshot, not an authoritative monetary ledger. Optional estimated savings requires amount, currency, and period together.

## Anomalies prevented

- Updating a service name changes one catalog row rather than every subscription or payment.
- Adding a category or user requires no subscription or payment.
- Deleting a service default does not erase category or subscription history.
- Archiving/cancelling a subscription does not delete payments or refunds.
- One logical notification occurrence cannot be inserted twice for the same user.
- A notification or recommendation link cannot point at another user's subscription.

## BCNF, 4NF, and 5NF assessment

Most entity relations satisfy BCNF because every meaningful determinant is a candidate key: identity IDs, normalized catalog names, normalized email, or explicit user-scoped identity keys. `recommendation_subscriptions` has only facts about its complete composite key. Repeated `user_id` in ownership-aware relationships is constrained by composite foreign keys rather than an unconstrained descriptive duplication.

Independent multi-valued facts are separated: payments, refunds, sessions, notifications, recommendation links, and audit events are rows in their own relations. This avoids the cross-product anomalies that 4NF addresses. The many-to-many recommendation/subscription relationship is represented by its irreducible join table; there is no known nontrivial join dependency requiring further 5NF decomposition. Claims beyond the documented dependencies would require new business rules.

The result satisfies 3NF for operational relational facts and, relation by relation, generally BCNF/4NF/5NF under current rules. Two deliberate snapshots remain: historical payment amount/currency required for correctness and JSONB recommendation/audit evidence required for reproducibility. They describe events at their own keys rather than current catalog facts.
