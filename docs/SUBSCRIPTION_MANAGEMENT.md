# Stage 5 — Subscription Management System

## 1. Executive Summary

SpendWise AI Stage 5 delivers the application's core subscription management capabilities. Authenticated users can record, discover, monitor, categorize, update, pause, reactivate, and soft-archive their recurring subscriptions across web and mobile viewports.

Every subscription is backed by normalized PostgreSQL relational tables, strictly bound to the authenticated user ID, and guarded by check constraints, database foreign keys, and application-level validation.

---

## 2. Architecture & Design Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                               │
│                                                                        │
│  /subscriptions         /subscriptions/new     /subscriptions/:id      │
│  (List, Table, Filter)  (Add Subscription)     (Details & Lifecycle)   │
│                                                                        │
│  Components:                                                           │
│  - SubscriptionTable        - SubscriptionFilters                      │
│  - SubscriptionCard         - SubscriptionStatusBadge                  │
│  - ConfirmArchiveModal      - SubscriptionEmptyState                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Axios HTTP (Bearer Access Token)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Express 5 REST API                               │
│                                                                        │
│  /api/v1/categories   /api/v1/services   /api/v1/subscriptions        │
│  Middleware:                                                           │
│  - authenticate (JWT validation & session verification)                │
│  - validateBody & validateQuery (Zod strict validation)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Parameterized SQL queries
┌───────────────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL 18.6 Database                            │
│                                                                        │
│  Tables:                                                               │
│  - categories (shared catalog)                                         │
│  - services (shared catalog, optional default category)                │
│  - subscriptions (user-owned, composite unique key (user_id, id))      │
│                                                                        │
│  Constraints:                                                          │
│  - chk_subscriptions_service_source (Catalog XOR Custom)               │
│  - chk_subscriptions_price (price >= 0)                                │
│  - chk_subscriptions_next_renewal (required for active/trial)          │
│  - chk_subscriptions_cancellation (status = 'cancelled' <=> timestamp) │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets

1. **Direct Parameterized SQL:** Queries execute through node-postgres (`pg`) without an ORM, fulfilling DBMS university project learning requirements.
2. **Strict User Isolation:** All subscription queries enforce `WHERE user_id = $authenticatedUserId` and composite unique index `(user_id, id)`. Users cannot access, modify, archive, or list another user's records under any circumstance.
3. **Reference Catalog vs. Custom Services:** Users can choose from curated catalog services (Netflix, Spotify, Notion, etc.) or declare custom service names (e.g., Campus Gym, Local Newspaper). Custom services never mutate or pollute global shared catalog tables.
4. **Soft Archival Policy:** Archiving sets `archived_at = CURRENT_TIMESTAMP`, hiding records from active lists and active spend calculations while preserving referential integrity for future payments (Stage 6). Subscriptions can be restored at any time.
5. **Deterministic Date & Invariant Synchronization:** Dates are formatted as ISO strings (`YYYY-MM-DD`). Check constraints ensure renewal dates and trial end dates never precede start dates, and `cancelled_at` is kept synchronized with status transitions.

---

## 3. Database Schema & Relational Integrity

The subscription system uses the Stage 3 relational schema defined in `server/db/migrations/001_initial_schema.sql`.

### Table: `subscriptions`

| Column | Type | Constraints & Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Unique subscription identifier |
| `user_id` | `BIGINT` | `NOT NULL, REFERENCES users(id)` | Owning user ID |
| `service_id` | `BIGINT` | `NULLABLE, REFERENCES services(id)` | Catalog service reference |
| `custom_service_name` | `VARCHAR(120)` | `NULLABLE, CHECK 1..120 chars` | Custom service name if not in catalog |
| `category_id` | `BIGINT` | `NOT NULL, REFERENCES categories(id)` | Subscription category |
| `plan_name` | `VARCHAR(120)` | `NULLABLE, CHECK 1..120 chars` | Specific plan or tier name |
| `price` | `NUMERIC(12, 2)` | `NOT NULL, CHECK (price >= 0)` | Recurring cost |
| `currency_code` | `VARCHAR(3)` | `NOT NULL, CHECK (regex ^[A-Z]{3}$)` | ISO 4217 3-letter currency code |
| `billing_cycle` | `VARCHAR(20)` | `NOT NULL, CHECK IN ('monthly', 'quarterly', 'yearly')` | Billing cycle interval |
| `status` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'active'` | Status: `trial`, `active`, `paused`, `cancelled` |
| `start_date` | `DATE` | `NOT NULL` | Subscription inception date |
| `next_renewal_date` | `DATE` | `NULLABLE, CHECK (>= start_date)` | Next scheduled renewal date |
| `trial_end_date` | `DATE` | `NULLABLE, CHECK (>= start_date)` | Trial conclusion date |
| `cancelled_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when marked as cancelled |
| `archived_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when soft-archived |
| `notes` | `TEXT` | `NULLABLE, CHECK length <= 2000` | Optional notes |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Row modification timestamp |

### Database Constraints Enforced

- **Service Source Exclusivity (`chk_subscriptions_service_source`):**
  ```sql
  CHECK (
    (service_id IS NOT NULL AND custom_service_name IS NULL)
    OR (
      service_id IS NULL
      AND custom_service_name IS NOT NULL
      AND char_length(btrim(custom_service_name)) BETWEEN 1 AND 120
    )
  )
  ```
- **Next Renewal Date Rule (`chk_subscriptions_next_renewal`):**
  ```sql
  CHECK (
    (next_renewal_date IS NULL OR next_renewal_date >= start_date)
    AND (status NOT IN ('trial', 'active') OR next_renewal_date IS NOT NULL)
  )
  ```
- **Trial End Date Rule (`chk_subscriptions_trial_end`):**
  ```sql
  CHECK (
    (trial_end_date IS NULL OR trial_end_date >= start_date)
    AND (status <> 'trial' OR trial_end_date IS NOT NULL)
  )
  ```
- **Cancellation Timestamp Synchronization (`chk_subscriptions_cancellation`):**
  ```sql
  CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled' AND cancelled_at IS NULL)
  )
  ```

---

## 4. API Reference

All subscription endpoints are mounted under `/api/v1` and require standard JWT authentication (`Authorization: Bearer <token>`). Reference catalog endpoints (`/categories` and `/services`) are public read-only endpoints.

### 4.1 Reference Catalogs

#### `GET /api/v1/categories`
Returns all available shared subscription categories sorted by name.

**Response `200 OK`:**
```json
{
  "categories": [
    {
      "id": "4",
      "name": "Cloud Storage",
      "description": "Cloud file storage, backup, and synchronization services.",
      "createdAt": "2026-10-15T00:00:00.000Z"
    },
    {
      "id": "3",
      "name": "Education",
      "description": "Learning platforms, courses, and academic resources.",
      "createdAt": "2026-10-15T00:00:00.000Z"
    }
  ]
}
```

#### `GET /api/v1/services`
Returns all active shared services, optionally filtered by `?search=<term>`.

**Response `200 OK`:**
```json
{
  "services": [
    {
      "id": "1",
      "name": "Netflix",
      "defaultCategoryId": "1",
      "categoryName": "Entertainment",
      "websiteUrl": "https://www.netflix.com",
      "isActive": true,
      "createdAt": "2026-10-15T00:00:00.000Z"
    }
  ]
}
```

---

### 4.2 Subscriptions API

#### `POST /api/v1/subscriptions`
Creates a new subscription for the authenticated user.

**Request Body (Catalog Service):**
```json
{
  "serviceId": "1",
  "categoryId": "1",
  "planName": "Standard 4K",
  "price": 22.99,
  "currencyCode": "USD",
  "billingCycle": "monthly",
  "status": "active",
  "startDate": "2026-10-15",
  "nextRenewalDate": "2026-11-15",
  "notes": "Family streaming plan"
}
```

**Request Body (Custom Service):**
```json
{
  "customServiceName": "Campus Recreation Gym",
  "categoryId": "5",
  "price": 45.00,
  "currencyCode": "USD",
  "billingCycle": "monthly",
  "status": "active",
  "startDate": "2026-10-15",
  "nextRenewalDate": "2026-11-15"
}
```

**Response `201 Created`:**
```json
{
  "subscription": {
    "id": "1",
    "userId": "1",
    "serviceId": "1",
    "customServiceName": null,
    "serviceName": "Netflix",
    "categoryId": "1",
    "categoryName": "Entertainment",
    "serviceWebsiteUrl": "https://www.netflix.com",
    "planName": "Standard 4K",
    "price": 22.99,
    "currencyCode": "USD",
    "billingCycle": "monthly",
    "status": "active",
    "startDate": "2026-10-15",
    "nextRenewalDate": "2026-11-15",
    "trialEndDate": null,
    "cancelledAt": null,
    "archivedAt": null,
    "notes": "Family streaming plan",
    "createdAt": "2026-10-15T02:00:00.000Z",
    "updatedAt": "2026-10-15T02:00:00.000Z"
  }
}
```

#### `GET /api/v1/subscriptions`
Retrieves a paginated, filtered, and sorted list of subscriptions belonging to the caller.

**Query Parameters:**
- `page` *(optional, integer, default 1)*: Page number.
- `limit` *(optional, integer 1..100, default 10)*: Results per page.
- `search` *(optional, string)*: Case-insensitive search on service name or plan name.
- `status` *(optional)*: Filter by `trial`, `active`, `paused`, or `cancelled`.
- `categoryId` *(optional)*: Filter by category ID.
- `billingCycle` *(optional)*: Filter by `monthly`, `quarterly`, or `yearly`.
- `archived` *(optional)*: `false` (default: only unarchived), `true` (only archived), or `all`.
- `sortBy` *(optional, default `createdAt`)*: `serviceName`, `price`, `nextRenewalDate`, `startDate`, `createdAt`.
- `sortOrder` *(optional, default `desc`)*: `asc` or `desc`.

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "1",
      "userId": "1",
      "serviceName": "Netflix",
      "categoryName": "Entertainment",
      "price": 22.99,
      "currencyCode": "USD",
      "billingCycle": "monthly",
      "status": "active",
      "nextRenewalDate": "2026-11-15"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

#### `GET /api/v1/subscriptions/:id`
Retrieves full details for a single subscription owned by the authenticated user.

**Response `200 OK`:** Full subscription object.
**Response `404 Not Found`:** Returned if the subscription does not exist or belongs to another user.

#### `PATCH /api/v1/subscriptions/:id`
Performs a partial update on the subscription.

**Supported Update Fields:** `price`, `billingCycle`, `planName`, `categoryId`, `startDate`, `nextRenewalDate`, `trialEndDate`, `status`, `notes`, `serviceId`, `customServiceName`.

**Rules:**
- Switching to `serviceId` clears `customServiceName`.
- Switching to `customServiceName` clears `serviceId`.
- Transitioning to status `cancelled` sets `cancelled_at = CURRENT_TIMESTAMP`.
- Transitioning away from `cancelled` clears `cancelled_at = NULL`.
- Updates to archived subscriptions return `400 Bad Request` with code `SUBSCRIPTION_ARCHIVED`.

#### `POST /api/v1/subscriptions/:id/archive`
Soft-archives the subscription. Sets `archived_at = CURRENT_TIMESTAMP`.

#### `POST /api/v1/subscriptions/:id/restore`
Restores an archived subscription. Sets `archived_at = NULL`.

---

## 5. Frontend Architecture & User Interface

The React 19 frontend is implemented with modular pages and reusable components located under `client/src/`:

### 5.1 Route Tree
- `/subscriptions`: `SubscriptionsPage` (Main dashboard with KPI cards, search, multi-field filters, active/archived tabs, desktop table, mobile card grid, and pagination).
- `/subscriptions/new`: `AddSubscriptionPage` (Interactive form with Catalog vs Custom toggle, auto-category selection, cycle calculations, and client-side validation).
- `/subscriptions/:id`: `SubscriptionDetailsPage` (Comprehensive view with normalized cost projections, lifecycle timelines, quick pause/cancel/reactivate actions, and archival modal).
- `/subscriptions/:id/edit`: `EditSubscriptionPage` (Pre-populated form for modifying pricing, schedules, and service provider).

### 5.2 Key Components
- `SubscriptionTable`: Accessible tabular presentation with column sorting, hover states, badges, and inline actions.
- `SubscriptionCard`: Mobile-first card view displaying service links, monthly equivalent price calculations, and renewal tags.
- `SubscriptionFilters`: Integrated search input, status, category, and billing cycle selectors, active/archived tabs, and one-click filter reset.
- `SubscriptionStatusBadge`: Color-coded semantic badges for `trial` (cyan), `active` (emerald), `paused` (amber), `cancelled` (rose), and `archived` (slate).
- `ConfirmArchiveModal`: Modal dialog explaining soft archival semantics and preventing accidental data modifications.
- `SubscriptionEmptyState`: Contextual empty states with guidance for zero subscriptions, filtered out states, or empty archived lists.

### 5.3 Cost Normalization Utility (`client/src/utils/cost.js`)
Normalizes recurring prices to comparable monthly estimates:
$$\text{Monthly Equivalent} = \begin{cases} \text{price} & \text{if monthly} \\ \text{price} / 3 & \text{if quarterly} \\ \text{price} / 12 & \text{if yearly} \end{cases}$$

---

## 6. Verification & Automated Testing

### 6.1 Test Suites

| Suite | File | Tests | Coverage |
| :--- | :--- | :--- | :--- |
| **Backend Integration Tests** | `server/tests/subscription.integration.test.js` | 8 test cases | Catalog querying, search, 401 unauthenticated blocks, catalog creation, custom creation, mutual exclusivity, constraint validation, filtering, sorting, pagination, status transitions, soft archival, and multi-tenant isolation against `spendwise_test`. |
| **Frontend Unit & Workflow Tests** | `client/src/tests/subscriptions.test.jsx` | 7 test cases | Subscriptions page rendering, KPI calculation, tab switching, empty state, catalog creation form, custom creation form, details view, status toggling, confirm archive modal, and edit form. |
| **Complete Workspace Test Suite** | `npm run test` | 55 passing tests | 35 server tests + 20 client tests. |

### 6.2 Quality Gates Passed
- **Linting:** `npm run lint` (0 errors, 0 warnings across all workspaces).
- **Code Style:** `npm run format:check` (All files match Prettier standards).
- **Build:** `npm run build` (Vite client production build succeeded cleanly).
