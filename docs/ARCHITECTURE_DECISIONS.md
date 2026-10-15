# Architecture Decisions

This record captures accepted technical decisions from Stages 2 and 3. It complements the conceptual architecture in [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) and does not redefine the planned business requirements.

## ADR-001: npm Workspaces Monorepo

**Status:** Accepted

**Decision:** Use one private root npm package with `client` and `server` workspaces and one root `package-lock.json`.

**Rationale:** A single installation command and shared quality tooling keep local Windows development simple while preserving clear frontend/backend boundaries. Workspace-specific scripts remain independently runnable.

**Consequences:** Dependencies are installed from the repository root. Workspace lockfiles are not created. The root coordinates development, lint, test, and build commands.

## ADR-002: JavaScript ES Modules and Node.js Baseline

**Status:** Accepted

**Decision:** Use modern JavaScript ES modules throughout. Pin the local baseline in `.nvmrc` to Node.js `22.19.0` and require Node.js `22.13.0` or newer.

**Rationale:** The installed environment is Node.js 22.19.0, and the selected Vite and ESLint releases require a modern Node runtime. This avoids TypeScript or transpilation in the backend while supporting current tooling.

**Consequences:** Developers using another maintained Node.js LTS release must still satisfy the package engine constraints. CommonJS `require` syntax is not used in application files.

## ADR-003: Current Vite and Tailwind Integration

**Status:** Accepted

**Decision:** Use Vite with React and Tailwind CSS through the official `@tailwindcss/vite` plugin and `@import 'tailwindcss'`.

**Rationale:** This is the supported Tailwind 4 integration and avoids obsolete PostCSS configuration copied from older tutorials.

**Consequences:** There is no `tailwind.config.js` in Stage 2. Theme tokens and base rules live in the global stylesheet and can be expanded when the design system requires them.

## ADR-004: Versioned REST API and Simple JSON Contracts

**Status:** Accepted

**Decision:** Mount API routes under `/api/v1`. Successful health responses use a small resource-specific object. Errors use:

```json
{
  "status": "error",
  "message": "Safe description"
}
```

The database health endpoint intentionally uses `database: "unavailable"` without internal error details.

**Rationale:** Versioning provides an evolution boundary, while deliberately small response objects avoid a premature abstraction around APIs that do not yet exist.

**Consequences:** Future stages must document additions to the response convention before relying on pagination, validation details, or authentication errors.

## ADR-005: Express Application and Process Separation

**Status:** Accepted

**Decision:** `server/src/app.js` creates and exports the Express application; `server/src/index.js` owns the HTTP listener and process lifecycle.

**Rationale:** Tests can exercise the application without binding the production port. Startup, shutdown, and transport concerns do not leak into routing or middleware.

**Consequences:** Route modules receive dependencies through small factory functions where deterministic tests benefit from injection. Process signal handling remains in the startup module.

## ADR-006: Lazy, Optional PostgreSQL Pool

**Status:** Accepted

**Decision:** Configure one reusable `pg` pool from an optional server-side `DATABASE_URL`. Create the pool lazily on the first database query and close it during graceful shutdown.

**Rationale:** The basic API must run before PostgreSQL is installed, while the database health endpoint must report the real connection state safely. One connection-string strategy avoids ambiguous mixed configuration.

**Consequences:** `/api/v1/health` remains available without PostgreSQL. `/api/v1/health/database` returns HTTP 503 when `DATABASE_URL` is absent or unreachable. Stage 3 will add migrations and schema objects without replacing this connection boundary.

## ADR-007: Stage 2 Testing Strategy

**Status:** Accepted

**Decision:** Use Node.js's built-in test runner with Supertest for backend HTTP behavior. Treat the Vite production build as the Stage 2 frontend compilation check.

**Rationale:** This covers the required foundation behavior with few dependencies. Database access is injected in tests, so no external PostgreSQL server is required for deterministic health tests.

**Consequences:** Frontend component and browser automation tools are deferred until the UI gains business workflows that justify them. Later stages can add test tools without replacing the HTTP tests.

## ADR-008: Security Scope for the Foundation

**Status:** Accepted

**Decision:** Stage 2 restricts CORS to the configured frontend origin, removes the Express technology header, limits JSON request size, validates environment configuration, and sanitizes database health failures.

**Rationale:** These controls directly protect the current foundation without pretending authentication exists.

**Consequences:** JWT authentication, password hashing, authorization, rate limiting, broader security headers, validation schemas, and deployment TLS remain owned by later stages. No current route accepts or stores user data.

## ADR-009: PostgreSQL Identity Keys and Text Statuses

**Status:** Accepted in Stage 3

**Decision:** Use PostgreSQL-generated `BIGINT GENERATED ALWAYS AS IDENTITY` keys for domain entities. Use constrained text for status and cycle values rather than PostgreSQL enums.

**Rationale:** Numeric identities are consistent and appropriate for this single-database application. Text plus named `CHECK` constraints remains readable and easier to extend with a migration than enum-value lifecycle management.

**Consequences:** Public APIs must not treat sequential identifiers as authorization. Adding a status requires a versioned constraint migration and corresponding application validation.

## ADR-010: Catalog and Custom Subscription Model

**Status:** Accepted in Stage 3

**Decision:** Categories and known services are shared catalogs. Every subscription selects a category and identifies exactly one shared `service_id` or one `custom_service_name`. A service's category is only a default.

**Rationale:** Shared metadata avoids duplication while the exclusive custom-name path lets users track providers absent from the catalog without publishing personal entries globally. Required subscription category supports user overrides and stable reporting.

**Consequences:** Multiple subscriptions to one service are valid. Runtime validation and the database constraint must preserve the exclusive provider choice.

## ADR-011: Historical Financial Events and Refunds

**Status:** Accepted in Stage 3

**Decision:** Store explicit payment events only, with historical amount and currency snapshots. Store partial and multiple refunds in a separate `refunds` table. Count only completed payments as gross realized spend and only completed refunds as reductions.

**Rationale:** Projected renewals are not evidence of payment. Separate refund events preserve auditability and avoid overwriting payment facts.

**Consequences:** Current subscription price changes do not alter history. Reports aggregate completed refunds before joining payments and always group money by currency. Stage 6 must transactionally enforce that completed refunds do not exceed the related completed payment because that cross-row invariant is not safe as a row-level check.

## ADR-012: Preservation, Archival, and Referential Actions

**Status:** Accepted in Stage 3

**Decision:** Use `archived_at` for ordinary subscription removal and keep cancellation as a distinct lifecycle status. Restrict deletion of users, subscriptions, payments, categories, and services when historical dependants exist. Cascade preferences with their user and recommendation-link rows with their recommendation; set an obsolete service default category to null.

**Rationale:** Financial history must not disappear through routine catalog or subscription deletion. Narrow cascades are limited to records with no independent meaning.

**Consequences:** Account erasure requires a deliberate future workflow. A cancelled subscription can remain visible and unarchived, while an archived subscription can retain any status.

## ADR-013: Ownership Reinforcement Without Row-Level Security

**Status:** Accepted in Stage 3

**Decision:** Use composite foreign keys to ensure subscription notifications and recommendation links share the same `user_id` as the referenced subscription. Defer PostgreSQL row-level security.

**Rationale:** Composite relationships prevent internally inconsistent cross-user links. Authentication identity, connection pooling, and future repository design need to stabilize before an RLS session-context policy can be designed safely.

**Consequences:** Database constraints reinforce relationships but do not authorize API callers. Stage 4+ repositories must derive ownership from authenticated identity and filter all user-owned SQL by `user_id`; RLS can be reconsidered in Stage 11.

## ADR-014: Transactional, Checksum-Tracked SQL Migrations

**Status:** Accepted in Stage 3

**Decision:** Keep ordered SQL files under `server/db/migrations` and apply them with the project runner. Track identifiers, SHA-256 checksums, and application times in `schema_migrations`; serialize runners with a PostgreSQL advisory transaction lock.

**Rationale:** Direct SQL is a DBMS learning objective and avoids an ORM or migration-framework dependency. Transactions prevent partial migrations, while checksums detect drift in already-applied files.

**Consequences:** Applied files are immutable. Schema changes require the next zero-padded migration. The runner applies no destructive reset; only the guarded test suite rebuilds `spendwise_test.public`.

## ADR-015: Reference and Demo Seed Separation

**Status:** Accepted in Stage 3

**Decision:** Keep idempotent shared catalog seeds separate from fictional demo records. Permit demo seeding only in `development`, with `ALLOW_DEMO_SEED=true`, on the exact database name `spendwise_dev`.

**Rationale:** Catalog entries are useful baseline data, while financial fixtures should never reach test or production accidentally. Three independent guards make intent explicit.

**Consequences:** Catalog seeding is safe to repeat and does not store service prices. Demo users use reserved `.invalid` domains and a non-login fixture hash; live account creation remains Stage 4.

## ADR-016: Dual-Token Authentication with Rotating Refresh Sessions and Replay Detection

**Status:** Accepted in Stage 4

**Decision:** Use short-lived in-memory JWT access tokens (15 minutes) paired with rotating refresh tokens stored as SHA-256 hashes in a dedicated PostgreSQL `auth_sessions` table. Transmit refresh tokens via HTTP-only, SameSite=Lax cookies scoped to `/api/v1/auth`. Enforce CSRF protection on state-changing auth endpoints through custom headers (`Origin` and `X-Requested-With`). If an already-rotated refresh token hash is presented, immediately revoke the entire session as a replay detection safeguard.

**Rationale:** Short-lived access tokens minimize exposure windows without requiring continuous database hits for every request, while server-side session rows in PostgreSQL retain immediate revocation control upon logout or password change. Storing only SHA-256 hashes of the random 256-bit refresh secrets ensures that a database compromise does not leak live session credentials.

**Consequences:** Access tokens are never stored in localStorage or persistent cookies. The client must handle automatic token renewal through interceptors. A database query verifies session validity and account status when validating tokens.

## ADR-017: Transparent Client Session Recovery with Axios Interceptors

**Status:** Accepted in Stage 4

**Decision:** Implement an Axios response interceptor that catches HTTP 401 responses on protected endpoints (such as `/api/v1/auth/me` and `/api/v1/users/me`), invokes a single shared `/api/v1/auth/refresh` request, updates the in-memory access token, and retries the original request. Explicitly bypass this recovery mechanism for unrefreshable authentication requests (`/auth/login`, `/auth/register`, `/auth/refresh`, and `/auth/logout`) to prevent loops and misleading error reporting.

**Rationale:** Users should remain seamlessly signed in across token expirations without user-facing interruptions, while login credential failures must propagate immediately as 401 errors.

**Consequences:** Parallel requests that encounter 401 share a single inflight refresh promise, preventing duplicate token rotation requests. If the refresh request itself fails, all active auth state is wiped and the user is redirected to sign in.

## ADR-018: Strict Separation of React Context and Hook Exports

**Status:** Accepted in Stage 4

**Decision:** Separate React Context creation (`authContext.js`), custom consumer hooks (`useAuth.js`), and Context Provider components (`AuthContext.jsx`) into isolated modules.

**Rationale:** React Fast Refresh and Vite's ESLint rules (`react-refresh/only-export-components`) require component files to only export React components to enable reliable hot module replacement. Exporting hooks or mutable contexts alongside components invalidates fast refresh boundaries.

**Consequences:** Consumer components import `useAuth` from `useAuth.js` rather than the provider file. Fast refresh operates cleanly without full page reloads during auth state modifications.

## ADR-019: Subscription Ownership and Multi-Tenant Isolation Pattern

**Status:** Accepted in Stage 5

**Decision:** Enforce multi-tenant subscription isolation exclusively at the PostgreSQL query level by parameterizing the verified authenticated user ID (`WHERE user_id = $1`) on every subscription query, mutating operation, and detail fetch. Reinforce this constraint in the schema via a composite unique key `(user_id, id)`. Never trust client-supplied user identifiers.

**Rationale:** Preventing cross-tenant data leaks and unauthorized state alterations is a fundamental security requirement. Direct parameterization guarantees that missing or altered request headers cannot expose or mutate another user's records.

**Consequences:** Any read, edit, archive, or restore attempt targeting a subscription owned by a different user returns an immediate 404 Not Found error, preventing account enumeration or existence probing.

## ADR-020: Soft Archival Policy with Historical Integrity Preservation

**Status:** Accepted in Stage 5

**Decision:** Implement subscription deletion as soft archival via a timestamped `archived_at` column. Do not perform physical SQL `DELETE` operations on subscription rows. Exclude archived subscriptions from default listings and active cost estimates, but permit users to view, search, and restore them via `/subscriptions/:id/restore`.

**Rationale:** Physical deletions would trigger cascade deletions or violate foreign key constraints on dependent financial transactions (payments and refunds in Stage 6). Soft archival retains historical accounting integrity and allows users to revisit past spending without skewing active renewal reminders.

**Consequences:** Direct updates to archived subscriptions are blocked until restored. Active cost projections explicitly filter for `archived_at IS NULL` and active statuses (`active` or `trial`).

## ADR-021: Mutually Exclusive Service Source Representation

**Status:** Accepted in Stage 5

**Decision:** Enforce strict mutual exclusivity between catalog-backed services (`service_id`) and user-entered custom services (`custom_service_name`) through the database check constraint `chk_subscriptions_service_source` and matching Zod validation refinement. Custom service entries do not create new rows in the global `services` catalog table.

**Rationale:** Shared catalog entries provide normalized references and standardized icons/URLs for popular services. Allowing arbitrary user input to insert into the shared `services` catalog would pollute global reference data and risk cross-tenant tampering.

**Consequences:** The application handles catalog and custom services uniformly in queries through `COALESCE(svc.name, s.custom_service_name) AS service_name`. The frontend provides a clear toggle between catalog selection and custom name input.

## ADR-022: Manual Payment Tracking and Expected vs. Completed Separation

**Status:** Accepted in Stage 6

**Decision:** Treat SpendWise AI strictly as an informational recording system for user-attested external financial transactions. Never integrate automated payment gateways or auto-insert completed payment records when subscription renewal dates arrive or expire. Display unconfirmed renewal events as overdue alerts rather than realized expenditures.

**Rationale:** SpendWise AI does not process credit cards or execute banking transfers. Automatically inserting payment records upon renewal dates would falsify financial history whenever a user paused, cancelled, or altered payment externally without prior app update.

**Consequences:** Realized spending calculations aggregate only records with `payment_status = 'completed'`. Overdue subscriptions prompt the user with accessible warnings and manual "Record Payment" shortcuts.

## ADR-023: Exact Decimal Arithmetic via Integer Cents

**Status:** Accepted in Stage 6

**Decision:** Perform all money comparisons, additions, subtractions, and refund balance checks in Node.js using normalized integer cents (`cents = Math.round(Number(amount) * 100)`), serializing to/from fixed two-decimal strings (`(cents / 100).toFixed(2)`), and persisting in PostgreSQL as `NUMERIC(12, 2)`.

**Rationale:** IEEE-754 binary floating-point numbers incur precision and rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In financial accounting, floating-point drift can cause invalid balance checks or refund rejections. Integer cents provide exact, deterministic integer arithmetic.

**Consequences:** Decimal amounts passed into business logic and repository functions are converted to integer cents before validation. API boundary responses return clean two-decimal strings.

## ADR-024: Concurrency-Safe Refund Validation with Row-Level Locking

**Status:** Accepted in Stage 6

**Decision:** Wrap all refund creations in a PostgreSQL transaction (`database.withTransaction`) that begins by executing an exclusive row lock on the parent payment (`SELECT p.*, s.user_id FROM payments p JOIN subscriptions s ... WHERE p.id = $1 FOR UPDATE OF p`). Sum existing completed refunds within the same transaction and reject any new refund that would cause the aggregate refund sum to exceed the locked payment's amount.

**Rationale:** Without row-level locking, concurrent refund submissions (e.g., rapid double-clicking or parallel API calls) could both read an outdated refund sum before either inserts, resulting in total refunds exceeding the original payment amount.

**Consequences:** Concurrent refund attempts on the same payment queue sequentially in PostgreSQL. Once the first transaction completes, the second evaluates the updated total and returns a 400 Bad Request error if the refundable balance is exhausted.

## ADR-025: Strict Currency Separation in Recurring Cost Projections

**Status:** Accepted in Stage 6

**Decision:** Group recurring cost estimates (`/api/v1/billing/overview`) strictly by currency code without attempting ad-hoc conversions. Projections report monthly and yearly normalized amounts per currency (e.g., INR 1,498.00/mo and USD 19.99/mo).

**Rationale:** SpendWise AI does not maintain live exchange-rate feeds in Stage 6. Arbitrary or hard-coded exchange rates create misleading financial totals.

**Consequences:** The frontend renders separate cost projection cards for each active currency. The system never sums amounts with different currency codes.

## ADR-026: CTE-Based Double-Counting Prevention in 1-to-Many Financial Joins

**Status:** Accepted in Stage 7

**Decision:** In reporting queries aggregating categories or subscriptions (`getCategoryBreakdown`, `getSubscriptionBreakdown`), pre-aggregate completed payment totals and completed refund totals in separate Common Table Expressions (CTEs) before joining them back to the subscription or category dimension table. Never join `payments` directly with `refunds` in a single query block where a single payment row can join to multiple refund rows.

**Rationale:** A direct join `payments p LEFT JOIN refunds r ON p.id = r.payment_id` creates a 1-to-N Cartesian multiplication whenever multiple partial refunds exist for a single payment. Summing `p.amount` across such joined rows multiplies the payment gross by $N$, severely corrupting financial statements and accounting reconciliation. CTE pre-aggregation condenses payments and refunds to single rows per category or subscription before the outer join.

**Consequences:** Financial aggregates guarantee mathematical reconciliation: `net_amount = gross_amount - refund_amount`. Gross spending remains completely unaffected by the presence, count, or timing of partial refunds.

## ADR-027: Continuous Calendar Series Generation for Zero-Activity Periods

**Status:** Accepted in Stage 7

**Decision:** For monthly trend queries (`getMonthlySpendingTrends`), construct a continuous calendar timeline using PostgreSQL's `generate_series(date_trunc('month', $startDate), date_trunc('month', $endDate), interval '1 month')` cross-joined with distinct user currencies, left-joining aggregated payment and refund CTEs onto the continuous series.

**Rationale:** Financial time series without zero-filling omit calendar months that had no transaction activity (e.g., jumping directly from February to May). This distorts trend analysis, moving averages, and visualization axes. Database-level `generate_series` guarantees unbroken chronological reporting with explicit `0.00` balances.

**Consequences:** Frontends and downstream reporting receive complete, continuous timelines across any selected date range without needing client-side interpolation or gap-filling logic.

## ADR-028: Dual-Perspective Financial Modeling: Committed Estimates vs. Date-of-Event Cash Flow Realization

**Status:** Accepted in Stage 7

**Decision:** Explicitly segregate committed subscription recurring cost projections (`normalized_monthly_cost`) from realized historical cash flow. Realized cash flow attributes payments to their `payment_date` and refunds to their `refund_date`. Negative net cash flow (when refunds in a period exceed payments) must be accurately preserved as a deficit rather than clamped to zero.

**Rationale:** A user committing to an annual \$120 subscription has a \$10/mo recurring estimate. However, their actual cash flow is a \$120 payment on day 1 and \$0 in subsequent months. Conflating commitments with cash flow distorts both budget forecasting and historical reconciliation. Furthermore, refunds received in a month where no new payments were made represent a net cash inflow (negative spending); clamping net spending to zero violates fundamental accounting principles.

**Consequences:** Analytics interfaces and API payloads clearly distinguish committed recurring run-rates from realized cash flow. The API returns real signed net amounts (e.g., `-45.00`) and the UI renders them appropriately with distinct refund badges and indicators.

## ADR-031: User-Local Reminder Windows with Database-Enforced Event Identity

**Status:** Accepted in Stage 9

**Decision:** Evaluate an inclusive threshold-to-target window using the user's IANA timezone and date-only subscription fields. Persist the target date and enforce one renewal/trial notification per user, subscription, kind, and target date with a partial unique index plus `INSERT ... ON CONFLICT DO NOTHING`. Run the scanner independently from Express.

**Rationale:** Date-only billing terms must not shift across timezones, worker downtime needs bounded catch-up, and multiple/restarted processes must remain safe without an in-memory lock.

**Consequences:** Overdue dates create no new reminder, historical reminders remain immutable, changed target dates may create a new event, and worker deployment is a separate process. In-app delivery does not imply payment or external-provider action.

## ADR-035: Invoker-Security Database Objects and Bounded Auditing

**Status:** Accepted in Stage 11

**Decision:** Add exact immutable cost normalization, an ownership-filtered financial summary, a transaction-neutral recommendation maintenance procedure, a narrowly scoped subscription-terms audit trigger, and two `security_invoker` views. Revoke PUBLIC routine execution. Keep application ownership predicates mandatory.

**Consequences:** Shared calculations and audit behavior are consistent and transactionally tested without exposing credentials or broad privileged routines. Audit rows restrict physical subscription deletion, matching the existing soft-archive policy.

## ADR-036: Defer RLS Until Pool Identity Propagation Exists

**Status:** Accepted in Stage 11

**Decision:** Do not enable RLS on production tables while pooled connections authenticate as one role and do not set a trusted transaction-local user identity. Continue parameterized ownership predicates and composite ownership foreign keys.

**Consequences:** The verified authorization model remains stable. RLS can be added as defense in depth only with transaction-scoped identity setup/reset and adversarial pool-reuse tests.

## ADR-037: Evidence-Based Partial Covering Index

**Status:** Accepted in Stage 11

**Decision:** Add `idx_payments_completed_subscription_covering` only after comparing the same 50,000-row test workload before and after. Keep benchmark fixtures isolated to `spendwise_test` and report warm-cache samples honestly.

**Consequences:** The representative completed-payment aggregation changed from Index Scan to Index Only Scan and its measured mean fell from 0.612 ms to 0.480 ms, at the cost of maintaining one additional partial index.

## Deferred Decisions

- Materialized reporting and row-level security identity propagation: reconsider after production workload and deployment design
- Production hosting, TLS termination, monitoring, backups, and recovery: Stage 12

## ADR-032: Deterministic Recommendations with Optional Explanation-Only AI

**Status:** Accepted in Stage 10

**Decision:** Treat versioned deterministic rules and exact stored calculations as authoritative. An optional provider may rewrite only an allowlisted facts object and always falls back to deterministic text.

**Rationale:** Subscription usage, external plan prices, and provider actions are unavailable. A language model cannot safely infer them or become the financial calculator.

**Consequences:** Recommendations are reproducible and testable. No provider is configured in Stage 10, all functionality works offline, and provider output can never change persisted savings.

## ADR-033: Stable Recommendation Keys and Per-User Serialized Generation

**Status:** Accepted in Stage 10

**Decision:** Serialize generation by locking the authenticated user row, upsert `(user_id,recommendation_key)`, synchronize relationships in one transaction, and preserve dismissed/resolved state.

**Rationale:** Repeated or simultaneous analysis must not duplicate advice or overwrite user feedback.

**Consequences:** Current facts refresh safely, stale active rows become inactive without deletion, and genuinely new dated events can receive new identities.

## ADR-029: Coordinated Dashboard Fetching with Independent Widget State

**Status:** Accepted in Stage 8

**Decision:** Fetch dashboard aggregates through one `useDashboardData` boundary using the existing authenticated Axios client, `Promise.allSettled`, request cancellation, and request-generation checks. Maintain success/error/loading state per widget instead of treating the dashboard as one indivisible request.

**Rationale:** The dashboard consumes independent Stage 6 and Stage 7 endpoints. A failure in a noncritical chart must not hide valid financial summaries or renewals, while rapid filter changes must not allow stale responses to overwrite the current selection.

**Consequences:** Successful widgets remain useful during partial failure, retry is centralized, duplicate sibling requests are avoided, and no heavyweight data-fetching dependency is introduced.

## ADR-030: Recharts at a Lazy-Loaded Visualization Boundary

**Status:** Accepted in Stage 8

**Decision:** Use Recharts for dashboard charts and lazy-load the `/dashboard` route. Preserve exact decimal strings for text/tooltips and convert only safe finite values at the plotting boundary. Every chart has a textual or tabular alternative.

**Rationale:** Recharts fits the existing React stack and provides responsive, composable SVG charts, but chart libraries add bundle cost and JavaScript plotting cannot represent arbitrary PostgreSQL `NUMERIC` precision exactly.

**Consequences:** Public and authentication routes do not eagerly load the chart chunk. Charts remain interactive, while exact financial values and accessibility do not depend on SVG interpretation.

## ADR-038: Security Hardening, Defensive HTTP Headers, and Trust Proxy Architecture

**Status:** Accepted in Stage 12

**Decision:** Mount defensive HTTP security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`, `COOP`, and production HSTS) directly via centralized middleware, suppress server fingerprinting (`x-powered-by`), support configurable reverse proxy trust (`TRUST_PROXY`), and enforce non-disclosing `404 NOT_FOUND` responses for cross-tenant resource probes.

**Rationale:** Modern web applications face automated scanning, clickjacking, MIME-type sniffing, and tenant enumeration. Setting defensive headers centrally protects client browsing contexts, while a uniform 404 policy prevents malicious users from determining whether a subscription, payment, or recommendation ID belongs to another tenant.

**Consequences:** Browser security headers are emitted on all HTTP responses, production HTTPS environments enforce transport security, rate limiters extract real client IPs behind proxies like Cloudflare and Render, and resource existence is protected against enumeration attacks.

## ADR-039: Dual Verification Strategy: Browser E2E Automation and Deterministic API Journeys

**Status:** Accepted in Stage 12

**Decision:** Implement a dual-layer end-to-end verification strategy combining Playwright browser automation (`e2e/`) with an automated 21-workflow deterministic full-stack journey runner (`server/scripts/verifyUserJourneys.js`).

**Rationale:** Browser automation tests user-visible DOM interactions, client-side routing, and responsive rendering, but headless browser binaries may be restricted in lightweight CI containers or local minimal developer workstations. A complementary deterministic journey runner executes all 21 key full-stack workflows directly against live PostgreSQL and Express instances, guaranteeing complete end-to-end validation under any execution environment.

**Consequences:** Critical user workflows are tested both visually in Chromium and deterministically at the protocol/database layer. CI pipelines can run both suites reliably, and developers can verify full-stack health in seconds.

## ADR-040: Production Containerization and Cloud-Native Infrastructure as Code

**Status:** Accepted in Stage 12

**Decision:** Provide cloud-agnostic containerization (`Dockerfile`, `docker-compose.yml`) running Node.js 22 LTS under an unprivileged `node` user with healthcheck endpoints, alongside declarative infrastructure-as-code blueprints for Render (`render.yaml`) and Vercel (`vercel.json`), plus static SPA fallback rewrite rules (`_redirects`).

**Rationale:** Supporting diverse deployment environments (self-hosted VPS, Docker Compose, PaaS, and managed cloud) without code modification requires standardizing environment variable contracts, database SSL configuration (`DATABASE_SSL`), and static SPA client routing rewrites.

**Consequences:** The application is immediately deployable across Docker, Render, Vercel, Supabase, Neon, and traditional Linux servers. Infrastructure is documented declaratively in version control.


