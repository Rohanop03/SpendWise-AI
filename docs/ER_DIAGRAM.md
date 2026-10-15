# SpendWise AI Entity-Relationship Diagram

This diagram represents migrations `001_initial_schema.sql` through `003_notification_target_dates.sql`. Crow's-foot markers show cardinality; `o` marks an optional relationship. `schema_migrations` is an operational table used by the migration runner and has no domain relationships.

```mermaid
erDiagram
  USERS ||--|| USER_PREFERENCES : has
  USERS ||--o{ SUBSCRIPTIONS : owns
  CATEGORIES ||--o{ SERVICES : "is default for"
  CATEGORIES ||--o{ SUBSCRIPTIONS : classifies
  SERVICES o|--o{ SUBSCRIPTIONS : identifies
  SUBSCRIPTIONS ||--o{ PAYMENTS : has
  PAYMENTS ||--o{ REFUNDS : has
  USERS ||--o{ NOTIFICATIONS : receives
  SUBSCRIPTIONS o|--o{ NOTIFICATIONS : concerns
  USERS ||--o{ RECOMMENDATIONS : receives
  RECOMMENDATIONS ||--o{ RECOMMENDATION_SUBSCRIPTIONS : contains
  SUBSCRIPTIONS ||--o{ RECOMMENDATION_SUBSCRIPTIONS : supports

  USERS {
    bigint id PK
    varchar display_name
    varchar email UK
    varchar password_hash
    varchar account_status
    timestamptz created_at
    timestamptz updated_at
  }

  USER_PREFERENCES {
    bigint user_id PK,FK
    varchar preferred_currency
    varchar timezone
    boolean notifications_enabled
    smallint renewal_reminder_days
    smallint trial_reminder_days
  }

  CATEGORIES {
    bigint id PK
    varchar name UK
    text description
  }

  SERVICES {
    bigint id PK
    varchar name UK
    bigint default_category_id FK
    text website_url
    boolean is_active
  }

  SUBSCRIPTIONS {
    bigint id PK
    bigint user_id FK
    bigint service_id FK
    varchar custom_service_name
    bigint category_id FK
    numeric price
    varchar currency_code
    varchar billing_cycle
    varchar status
    date next_renewal_date
    timestamptz cancelled_at
    timestamptz archived_at
  }

  PAYMENTS {
    bigint id PK
    bigint subscription_id FK
    numeric amount
    varchar currency_code
    date payment_date
    varchar payment_status
  }

  REFUNDS {
    bigint id PK
    bigint payment_id FK
    numeric amount
    date refund_date
    varchar refund_status
  }

  NOTIFICATIONS {
    bigint id PK
    bigint user_id FK
    bigint subscription_id FK
    varchar notification_type
    date target_event_date
    timestamptz scheduled_for
    boolean is_read
    varchar deduplication_key UK
  }

  RECOMMENDATIONS {
    bigint id PK
    bigint user_id FK
    varchar recommendation_type
    jsonb evidence
    numeric estimated_savings
    varchar status
  }

  RECOMMENDATION_SUBSCRIPTIONS {
    bigint recommendation_id PK,FK
    bigint subscription_id PK,FK
    bigint user_id FK
    varchar relationship_role
  }

  SCHEMA_MIGRATIONS {
    varchar migration_id PK
    varchar checksum
    timestamptz applied_at
  }
```

## Relationship rules

- A user has exactly one preferences row after account creation; the foreign key also serves as the preferences primary key.
- A subscription belongs to one user and one category. It identifies either one shared service or one custom service name, never both.
- `services.default_category_id` is optional. A subscription's required category is the user's explicit classification and can override the service default.
- Payments and refunds are historical events. Their `RESTRICT` relationships prevent accidental loss of financial history.
- A notification may omit a subscription only for a system notification. Its composite foreign key ensures a referenced subscription belongs to the same user.
- A recommendation can involve zero or many subscriptions through `recommendation_subscriptions`. Composite foreign keys prevent cross-user links.
- The application archives subscriptions with `archived_at`; it does not physically delete them during ordinary use.
