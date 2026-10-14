# Stage 7 — Spending Analytics & SQL Reporting

## 1. Executive Summary

SpendWise AI Stage 7 delivers a PostgreSQL-powered financial analytics and reporting engine. Built on the authoritative subscription, payment, and refund records established in Stages 5 and 6, Stage 7 provides authenticated users with deep visibility into historical cash flows, category expense distributions, subscription-wise spending, billing cycle distributions, and recurring cost projections.

Every calculation is performed directly in PostgreSQL using parameterized queries with zero reliance on an Object-Relational Mapper (ORM), fulfilling key university Database Management Systems (DBMS) project requirements. Financial integrity invariants—such as date-of-event cash-flow attribution, exclusion of unconfirmed charges from realized expenditure, strict multi-currency isolation, and CTE-based double-counting prevention—are enforced systematically across all reporting services and endpoints.

---

## 2. Architecture & Design Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                               │
│                                                                        │
│  /analytics                                                            │
│  - Financial Overview Cards     - Monthly Trend Table (Cash Flow)      │
│  - Category Spending Table      - Subscription Spending Table          │
│  - Top Expensive Subscriptions  - Billing Cycle Distribution           │
│  - Payment Status Summary       - Date Presets & CSV Export            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Axios HTTP (Bearer Access Token)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Express 5 REST API                               │
│                                                                        │
│  /api/v1/analytics                                                     │
│  - GET /overview            - GET /trends           - GET /categories  │
│  - GET /subscriptions       - GET /top-subscriptions                   │
│  - GET /billing-cycles      - GET /payment-status   - GET /refunds     │
│  - GET /report              - GET /report/export (Streaming CSV)       │
│                                                                        │
│  Middleware:                                                           │
│  - authenticate (JWT validation & session verification)                │
│  - validateQuery (Zod strict query parameter schemas)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Parameterized SQL queries
                                    │ (Node-postgres pool)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL 18.6 Database                            │
│                                                                        │
│  Relational Tables Queried:                                            │
│  - users (account authentication & isolation)                          │
│  - categories (subscription taxonomy)                                  │
│  - services (catalog reference data)                                   │
│  - subscriptions (user recurring contracts, prices, billing cycles)    │
│  - payments (historical monetary transaction records)                  │
│  - refunds (reversal events tied to completed payments)                │
│                                                                        │
│  Advanced DBMS Features:                                               │
│  - Common Table Expressions (WITH)                                     │
│  - Multi-table INNER and LEFT JOINs                                    │
│  - Calendar series generation (generate_series) for zero-activity gaps │
│  - Filtered aggregates (COUNT ... FILTER) & CASE expressions           │
│  - Window functions (COUNT(*) OVER()) for server-side pagination       │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets

1. **Database-Driven Aggregation:** PostgreSQL performs all heavy grouping, filtering, joining, and aggregation. Raw transaction rows are never downloaded en masse into Node.js for client-side summation.
2. **Date-of-Event Cash Flow Accounting:** Historical reporting attributes financial events to their actual calendar occurrence:
   - A completed payment is recognized on its recorded `payment_date`.
   - A completed refund is recognized on its recorded `refund_date`.
   - Net cash flow for a period equals completed payments dated in that period minus completed refunds dated in that period.
3. **Double-Counting Prevention (CTE Aggregation Pattern):** Direct one-to-many SQL joins between payments and refunds inevitably multiply payment amounts when multiple partial refunds exist. Stage 7 solves this by pre-aggregating payments and refunds in separate CTEs or using event matrices before joining.
4. **Strict Currency Isolation:** Monetary totals are never combined across different currency codes (e.g., INR + USD). Aggregates are grouped strictly by ISO 4217 currency code.
5. **Exact Decimal Arithmetic:**authoritative totals are maintained as integer cents and formatted using decimal strings, preventing IEEE-754 binary floating-point drift.
6. **Strict Multi-Tenant Isolation:** All analytics queries join `subscriptions s` and parameterize `s.user_id = $authenticatedUserId`. Users can never inspect or aggregate financial records belonging to another tenant.

---

## 3. Financial Definitions & Calculation Rules

| Metric | Definition | Status Filter | Purpose |
| :--- | :--- | :--- | :--- |
| **Gross Completed Payments** | $\sum \text{amount}$ | `payment_status = 'completed'` | Realized outflow spent on external subscriptions |
| **Completed Refunds** | $\sum \text{amount}$ | `refund_status = 'completed'` | Realized reimbursement received from external providers |
| **Net Cash Flow** | $\text{Gross Payments} - \text{Completed Refunds}$ | Completed only | True financial cash impact during the reporting window |
| **Pending Payments** | $\sum \text{amount}$ | `payment_status = 'pending'` | Unconfirmed manual entries; excluded from realized spend |
| **Failed Payments** | $\sum \text{amount}$ | `payment_status IN ('failed', 'cancelled')` | Unsuccessful payment attempts; excluded from realized spend |
| **Estimated Monthly Cost** | Normalized monthly price equivalent | Active & Trial (`archived_at IS NULL`) | Forward recurring projection; not historical expenditure |
| **Estimated Yearly Cost** | Normalized annual price equivalent | Active & Trial (`archived_at IS NULL`) | Forward recurring projection; not historical expenditure |

### Treatment of Deficit / Negative Cash Flow

If completed refunds exceed completed payments during a specific reporting period (e.g., a refund received in March for an annual payment made in January), the net cash flow for that period will be negative. The system **never** clamps negative cash flow to zero. The UI displays an explicit `Deficit` badge.

---

## 4. REST API Specifications

All endpoints require authentication (`Authorization: Bearer <accessToken>`).

### 1. `GET /api/v1/analytics/overview`
Retrieves consolidated financial summary by currency for the selected date range.

**Query Parameters:**
- `startDate` (ISO Date `YYYY-MM-DD`, optional)
- `endDate` (ISO Date `YYYY-MM-DD`, optional)
- `currencyCode` (ISO 3-letter currency code, optional)

**Response (200 OK):**
```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-12-31" },
  "currencySummaries": [
    {
      "currencyCode": "INR",
      "grossPayments": "1500.00",
      "completedRefunds": "150.00",
      "netCashFlow": "1350.00",
      "completedPaymentCount": 3,
      "refundCount": 1,
      "pendingPaymentCount": 1,
      "pendingAmount": "500.00",
      "failedPaymentCount": 0,
      "failedAmount": "0.00",
      "activeSubscriptionCount": 2,
      "estimatedMonthlyRecurring": "1000.00",
      "estimatedYearlyRecurring": "12000.00"
    }
  ]
}
```

### 2. `GET /api/v1/analytics/trends`
Provides chronological monthly or yearly spending trends. Zero-activity months are filled automatically when a date range is supplied.

**Query Parameters:**
- `startDate` (ISO Date, optional)
- `endDate` (ISO Date, optional)
- `currencyCode` (ISO 3-letter currency code, optional)
- `interval` (`monthly` | `yearly`, default `monthly`)

**Response (200 OK):**
```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-03-31", "interval": "monthly" },
  "trends": [
    {
      "period": "2026-01",
      "currencyCode": "INR",
      "grossPayments": "1000.00",
      "completedRefunds": "0.00",
      "netCashFlow": "1000.00",
      "completedPaymentCount": 1,
      "refundCount": 0
    },
    {
      "period": "2026-02",
      "currencyCode": "INR",
      "grossPayments": "0.00",
      "completedRefunds": "300.00",
      "netCashFlow": "-300.00",
      "completedPaymentCount": 0,
      "refundCount": 1
    }
  ]
}
```

### 3. `GET /api/v1/analytics/categories`
Breaks down gross payments, completed refunds, and net cash flow by subscription category.

**Query Parameters:**
- `startDate`, `endDate`, `currencyCode`, `categoryId`

**Response (200 OK):**
```json
{
  "period": { "startDate": null, "endDate": null },
  "categories": [
    {
      "categoryId": "1",
      "categoryName": "Entertainment",
      "currencyCode": "INR",
      "grossPayments": "800.00",
      "completedRefunds": "250.00",
      "netCashFlow": "550.00",
      "completedPaymentCount": 1,
      "refundCount": 2,
      "percentageOfGross": 80.00
    }
  ]
}
```

### 4. `GET /api/v1/analytics/subscriptions`
Sortable and paginated list of all subscriptions with historical realized spending, refund counts, and current terms. Includes soft-archived subscriptions.

**Query Parameters:**
- `startDate`, `endDate`, `currencyCode`, `subscriptionId`
- `sortBy` (`grossPayments` | `netCashFlow` | `completedPaymentCount` | `serviceName` | `currentPrice`)
- `sortOrder` (`asc` | `desc`)
- `limit` (default 20, max 100), `offset` (default 0)

### 5. `GET /api/v1/analytics/top-subscriptions`
Ranks subscriptions by either forward recurring cost or historical realized spending.

**Query Parameters:**
- `type`: `recurring` (normalized monthly equivalent) | `historical` (gross payments)
- `currencyCode`, `limit` (default 5, max 50), `startDate`, `endDate`

### 6. `GET /api/v1/analytics/billing-cycles`
Summarizes active subscriptions grouped by billing cycle (`monthly`, `quarterly`, `yearly`) with normalized monthly and yearly cost estimates.

### 7. `GET /api/v1/analytics/payment-status`
Categorizes all payment records into `completed` (realized), `pending` (unconfirmed), `failed` (unsuccessful), and `cancelled` statuses with counts and totals.

### 8. `GET /api/v1/analytics/refunds`
Provides detailed metrics on full vs. partial refund occurrences and recent refund events.

### 9. `GET /api/v1/analytics/report` & `GET /api/v1/analytics/report/export`
Generates a composite financial report or streams a downloadable CSV document sanitized against spreadsheet formula injection.

---

## 5. PostgreSQL Query Architecture

For a comprehensive DBMS-evaluator guide featuring raw SQL queries, execution mechanisms, CTEs, and relational joins, see [ANALYTICS_SQL_QUERIES.md](ANALYTICS_SQL_QUERIES.md).

---

## 6. Frontend Features & User Experience

The React 19 interface (`/analytics`) provides a responsive, accessible financial reporting console:

1. **Period Selection & Presets:** Quick one-click filters for "This Month", "Last Month", "Last 3 Months", "This Year", "All Time", and custom start/end date pickers.
2. **Currency Isolation Toolbar:** Instant toggle across all currencies discovered in user records.
3. **Overview Cards:** High-density summary cards displaying Gross Outflow, Refunds, Net Cash Flow, Estimated Monthly Cost, and Estimated Yearly Cost.
4. **Tabular Monthly Trends:** Clear period-by-period financial reporting with negative cash flow indicators.
5. **Category Spending Table:** Realized spending with proportional percentage visualizers.
6. **Subscription-Wise Table:** Paginated and sortable table covering active, paused, cancelled, and archived subscriptions.
7. **Top Subscriptions Ranking:** Toggle between current recurring cost and historical gross spend.
8. **Billing Cycle Breakdown:** Cards detailing monthly, quarterly, and annual subscription commitments.
9. **Streaming CSV Export:** Immediate client-side download of formatted reports with formula injection protection.

---

## 7. Automated Testing & Verification

Stage 7 is backed by thorough integration and component test coverage:

- **Backend Integration Tests (`server/tests/analytics.integration.test.js`):** 7 comprehensive test suites executed live against PostgreSQL 18.6 (`spendwise_test`):
  - Overview calculations, pending/failed exclusion, refund deductions.
  - Multi-currency isolation (INR vs. USD).
  - Monthly trends date-of-event cash flow, negative cash flows, and zero-activity series.
  - Category analytics double-counting prevention with multiple refunds and percentage calculations.
  - Top subscriptions rankings (recurring vs. historical).
  - Custom report generation and CSV export sanitization.
  - Multi-tenant user isolation and input validation.
- **Frontend Component Tests (`client/src/tests/analytics.test.jsx`):** 7 component test suites verifying rendering, navigation tabs, filter presets, CSV export, and empty states.
- **Verification Suite Totals:**
  - `npm test --workspace client`: 5 test files, 32 tests passed.
  - `npm test --workspace server`: 9 test files, 48 tests passed.
  - `npm run test:db`: 5 integration test suites, 37 tests passed.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run format:check`: Passed.
  - `npm run build`: Production client bundle built in 1.05s.

---

## 8. Known Limitations & Stage 8 Readiness

- **Current Category Mapping:** Categories are associated with subscriptions rather than captured as an immutable snapshot on each individual payment row. If a subscription's category is changed, historical payments will be grouped under the new category. This design is documented and avoids redundant denormalization.
- **Stage 8 Readiness:** The analytics REST endpoints return clean, structured JSON datasets (`overview`, `trends`, `categories`, `subscriptions`, `billingCycles`) directly consumable by Stage 8's interactive charting library (e.g., Recharts) and visual financial dashboard widgets.
