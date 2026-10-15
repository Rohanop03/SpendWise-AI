# Stage 8 — Frontend Dashboard & Integration

## 1. Purpose

The protected `/dashboard` route is SpendWise AI's concise financial command center. It turns the existing Stage 7 PostgreSQL analytics results into interactive charts and operational summaries without moving financial authority into the browser. `/analytics` remains the detailed reporting surface with breakdown tables, sorting, and CSV export.

## 2. Route and Component Architecture

`DashboardPage` is lazy-loaded from the protected route tree so Recharts is kept out of the initial public/authentication route chunk. Its main component hierarchy is:

```text
DashboardPage
├── DashboardFilters
├── FinancialSummaryCards
├── SpendingTrendChart
├── UpcomingRenewalsWidget
├── CategorySpendingChart
├── TopSubscriptionsChart
├── BillingCycleChart
├── PaymentStatusWidget
├── RefundSummary
└── DashboardEmptyState
```

`useDashboardData` coordinates the independent API calls with `Promise.allSettled`. Each widget owns a loading, success, or error state, so a noncritical endpoint failure does not erase successful data. An `AbortController` cancels superseded requests, and a monotonically increasing request ID prevents stale responses from replacing newer filter results.

## 3. API Integration

The dashboard reuses the authenticated Axios client and existing access-token refresh interceptor. It consumes:

| Widget | Existing endpoint |
| --- | --- |
| Financial summary and currency inventory | `GET /api/v1/analytics/overview` |
| Monthly cash flow | `GET /api/v1/analytics/trends` |
| Category comparison | `GET /api/v1/analytics/categories` |
| Historical subscription ranking | `GET /api/v1/analytics/top-subscriptions?type=historical` |
| Billing-cycle commitments | `GET /api/v1/analytics/billing-cycles` |
| Payment state | `GET /api/v1/analytics/payment-status` |
| Refund summary | `GET /api/v1/analytics/refunds` |
| Renewal schedule | `GET /api/v1/billing/upcoming?days=30` |

No Stage 7 SQL or API response contract was changed for Stage 8.

## 4. Filters and URL State

The currency and period selection are stored in URL query parameters. Supported period presets are All Time, This Month, Last Month, Last 3 Months, This Year, Last 12 Months, and Custom. `dashboardFilters.js` is also used by the detailed Analytics page, preventing separate date-range implementations.

The default currency is the user's preferred currency. Choosing “Separate all currencies” stores an explicit `currency=ALL` state. Currency-independent results are never summed together: summary cards and charts render separate currency sections. Historical top-subscription ranking requires one selected currency because nominal values from different currencies are not comparable.

Historical date filters apply to payments and refunds. Recurring estimates, billing-cycle normalization, and renewals are labeled as current-state information and do not pretend to be historical transactions.

## 5. Charts and Financial Precision

Recharts provides responsive SVG charts:

- Monthly cash flow: composed area/line chart for gross payments, refunds, and signed net cash flow.
- Category spending: horizontal grouped bars for gross payments, refunds, and net cash flow. Percentage labels use the backend's gross-payment percentage; negative net values are never used as pie slices.
- Top subscriptions: horizontal historical gross-spending ranking using backend order.
- Billing cycles: monthly-equivalent commitment bars using backend-normalized totals.

PostgreSQL `NUMERIC` values remain decimal strings for labels, tables, and tooltips. Conversion to JavaScript `Number` occurs only in `toChartNumber` at the Recharts boundary. Values outside a conservative safe plotting range become `null` rather than receiving a misleading plotted value. The browser does not recompute authoritative totals, refund subtraction, recurring normalization, or cross-currency sums.

## 6. Accessibility

- Routes, sections, headings, form labels, and navigation landmarks are semantic.
- Filters and links are keyboard accessible with visible focus styles.
- Recharts receives `accessibilityLayer`; chart containers have descriptive labels.
- Monthly trends include an expandable exact-value table, while category, subscription, billing-cycle, payment, refund, and renewal widgets include visible textual values.
- Status meaning is expressed in text as well as color.
- Loading and error messages use live-region or alert semantics.
- Reduced-motion users receive nonanimated loading skeletons through `motion-reduce:animate-none`.

## 7. Responsive Behavior

The page uses a 12-column desktop grid, two-column intermediate layouts where useful, and single-column mobile stacking. Every chart parent is `min-w-0`, wide exact-value tables scroll inside their own containers, and the application shell prevents page-level horizontal overflow. The desktop navigation becomes a keyboard-accessible compact menu below the extra-large breakpoint.

## 8. Empty, Loading, and Error States

- A user with no subscriptions or payment history receives a truthful onboarding state linking to subscription creation.
- A user with subscriptions but no payments still sees current commitments and renewals while historical charts state that no transactions exist.
- Each widget renders its own skeleton and error state.
- Partial failures retain successful widgets and display an aggregate retry notice.
- Authentication failures continue through the existing refresh interceptor and protected-route behavior rather than appearing as empty financial data.

## 9. Performance Decisions

- The dashboard and Recharts are route-level lazy-loaded.
- Aggregated analytics endpoints are used instead of fetching transaction histories.
- Sibling widgets share one coordinated data hook and do not duplicate calls.
- Superseded requests are cancelled and stale response writes are rejected.
- Transformations are limited to chart-boundary mapping and currency grouping.

The production build reports the exact generated chunk sizes; they should be rechecked whenever the chart library or dashboard imports change.

## 10. Testing

Run:

```powershell
npm run test --workspace client -- src/tests/dashboard.test.jsx
npm run test --workspace client
npm run test:db
npm run lint
npm run format:check
npm run build
```

The Stage 8 tests cover route protection, authenticated rendering, exact formatted values, negative cash flow, category gross-share semantics, currency/date changes, all dashboard widgets, empty/loading/error/partial-failure states, and responsive shell structure. Existing Analytics tests continue to cover tables and CSV export.

## 11. Known Limitations

- Charts are visual projections of exact backend strings through finite JavaScript numbers; exact values remain in text and tables.
- Currency conversion is intentionally absent.
- Upcoming renewals are expected obligations, not confirmed payments.
- Manual refund records are not bank confirmations.
- No reminder scheduler, notification delivery, AI recommendation, external cancellation, or payment-provider integration is included.
