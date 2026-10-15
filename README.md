# SpendWise AI

> Smart Subscription Tracking & AI-Powered Cost Optimization

SpendWise AI is a university DBMS capstone project and production-grade full-stack platform designed to track recurring subscriptions, maintain an immutable billing ledger, generate explainable cost-reduction recommendations, and provide deep SQL-powered financial analytics.

The application is built on a PostgreSQL 18.6 relational engine with raw parameterized queries (`pg`), short-lived JWT access tokens, HttpOnly rotating refresh sessions, check constraints, row-level locks for financial integrity, defensive HTTP security headers, and a responsive React 19 UI.

## Current Status

**Stage 12 of 12 — Final Testing, Security Hardening, Deployment & Documentation (COMPLETED)**

All 12 development stages are fully implemented, verified, and documented:

- **Security Hardening & Multi-Tenant Isolation:** Centralized defensive HTTP security headers (`nosniff`, `DENY`, HSTS, COOP), proxy trust configuration, server fingerprint removal (`x-powered-by`), token forgery rejection, session revocation replay detection, and non-disclosing 404 responses on foreign resource access (see [docs/FINAL_TESTING_REPORT.md](docs/FINAL_TESTING_REPORT.md)).
- **Testing & E2E Automation:** 216 automated test points passing across verification suites, including 83 server unit & API tests, 50 client Vitest tests, 62 PostgreSQL integration tests, 13 security/isolation penetration tests, Playwright browser test specs (`e2e/`), and a deterministic 21-workflow full-stack user journey runner (`npm run test:journeys`).
- **Continuous Integration (CI/CD):** Automated GitHub Actions pipeline configuration (`.github/workflows/ci.yml`) validating formatting, linting, migrations, unit tests, integration tests, E2E journeys, and production builds against a PostgreSQL 16 service container.
- **Production Deployment Readiness:** Production multi-stage `Dockerfile` (non-root `node` user), `docker-compose.yml` multi-container orchestration, Render cloud blueprint (`render.yaml`), Vercel static configuration (`vercel.json`), and static SPA fallback routing (`_redirects`) (see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)).
- **AI-Powered Cost Optimization:** Versioned deterministic opportunity detector for exact duplicates, category concentration, price outliers, and trial expirations, with grounded natural language explanations (see [docs/AI_COST_OPTIMIZATION.md](docs/AI_COST_OPTIMIZATION.md)).
- **Advanced PostgreSQL DBMS:** Stored calculation functions, bounded recommendation procedures, transactional audit triggers (`subscription_audit_events`), security-invoker views, and a measured covering partial index improving mean execution time by 21.6% (0.612 ms to 0.480 ms) and dropping buffer hits from 15 to 6 blocks on 50,000 rows (see [docs/DATABASE_PERFORMANCE_REPORT.md](docs/DATABASE_PERFORMANCE_REPORT.md)).
- **Renewal Reminders & Worker:** User-local renewal/trial calendar windows, database-enforced alert deduplication, independent background polling worker daemon, and in-app Notification Center.
- **Spending Analytics & SQL Reporting:** Multi-currency financial cash flow analysis, zero-activity interval trend generation, category breakdowns, and streaming CSV export with spreadsheet formula injection protection.
- **Payment & Refund Ledger:** Immutable historical invoices, billing period tracking, and concurrency-safe refund balance recalculation with row-level locks.
- **Subscription Management:** Full CRUD, search, filtering, pagination, catalog vs. custom service handling, and soft archival.

## Technology Stack

| Layer | Implemented & Verified Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Recharts, Vitest, Testing Library |
| **Backend** | Node.js 22 LTS, Express 5, Zod validation, bcrypt, jsonwebtoken, pg connection pool |
| **Database** | PostgreSQL 18.6 / 16.x, raw parameterized SQL, migrations 001–005, stored functions & procedures, audit triggers, security-invoker views, covering partial index |
| **Security** | Defensive HTTP headers (HSTS, CSP, X-Frame-Options, nosniff), HttpOnly refresh cookies, CSRF defenses, rate limiting, SQL parameterization, CSV sanitization |
| **DevOps & QA**| Playwright Test, GitHub Actions CI, Docker, Docker Compose, Render Blueprint, Vercel, Prettier, ESLint |

No ORM is used. Direct PostgreSQL and relational algebra are central DBMS project objectives.

## Project Structure

```text
SpendWise-AI/
├── client/                       # React application
├── server/
│   ├── db/
│   │   ├── migrations/           # Immutable ordered SQL migrations
│   │   └── seeds/                # Catalog and guarded demo seeds
│   ├── scripts/                  # Migrate, seed, and connectivity commands
│   ├── src/
│   │   ├── config/               # Environment and PostgreSQL pool
│   │   ├── db/                   # Migration runner
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   └── tests/                    # HTTP, database unit, and integration tests
├── docs/                         # Requirements and technical documentation
├── package.json                  # npm workspace commands
└── package-lock.json             # Single repository lockfile
```

## Local Requirements

- Node.js `22.19.0` from `.nvmrc`, or a compatible maintained release satisfying `>=22.13.0`
- npm `10` or newer
- Git
- PostgreSQL 14 or newer for database migrations, seeds, and integration tests

The basic frontend and `/api/v1/health` can run without PostgreSQL. Database commands and live database health require it. See the [PostgreSQL Setup Guide](docs/DATABASE_SETUP.md) for Windows installation, dedicated role/database creation, and verification.

## Installation

From the repository root in PowerShell:

```powershell
npm install
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Configure private `DATABASE_URL` and `TEST_DATABASE_URL` values in `server/.env`; never commit that file. Then initialize development data:

```powershell
npm run db:check
npm run db:migrate
npm run db:seed
npm run dev
```

Open the frontend at `http://localhost:5173` and backend health at `http://localhost:5000/api/v1/health`.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together |
| `npm run dev:client` | Start only Vite |
| `npm run dev:server` | Start only Express in watch mode |
| `npm run db:check` | Print connected database, role, and server version |
| `npm run db:migrate` | Apply pending transactional SQL migrations |
| `npm run db:seed` | Idempotently seed shared catalogs |
| `npm run db:seed:demo` | Seed guarded fictional development fixtures |
| `npm run db:advanced:verify` | Verify Stage 11 objects in `spendwise_test` |
| `npm run db:benchmark` | Benchmark the covering index with self-cleaning test fixtures |
| `npm run db:demo` | Demonstrate ACID, isolation, serialization, and deadlocks safely |
| `npm run reminders:run-once` | Run one safe reminder eligibility scan |
| `npm run reminders:worker` | Start the independent recurring reminder worker |
| `npm run test:db` | Rebuild and test only the configured `spendwise_test` database |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run all server tests; DB integration skips without `TEST_DATABASE_URL` |
| `npm run format` | Format implementation, configuration, and documentation |
| `npm run format:check` | Check formatting without modifying files |
| `npm run build` | Build the frontend production bundle |

`test:db` is destructive only to `spendwise_test.public` and refuses any other database name.

## API Endpoints

All APIs use the `/api/v1` prefix.

| Method | Endpoint | Purpose | Auth required | Database required |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Verify Express is running | No | No |
| `GET` | `/api/v1/health/database` | Run `SELECT 1` through the pool | No | Yes |
| `POST` | `/api/v1/auth/register` | Register a new account with default preferences | No (Rate-limited) | Yes |
| `POST` | `/api/v1/auth/login` | Authenticate email/password; issue access & refresh tokens | No (Rate-limited) | Yes |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token; issue new access token | Cookie | Yes |
| `POST` | `/api/v1/auth/logout` | Revoke current refresh session & clear cookie | Cookie | Yes |
| `GET` | `/api/v1/auth/me` | Fetch currently authenticated user identity | Bearer JWT | Yes |
| `POST` | `/api/v1/auth/change-password` | Change password and revoke all active sessions | Bearer JWT | Yes |
| `PATCH` | `/api/v1/users/me` | Update display name for authenticated user | Bearer JWT | Yes |
| `GET` | `/api/v1/users/me/preferences` | Retrieve user settings & reminder preferences | Bearer JWT | Yes |
| `PATCH` | `/api/v1/users/me/preferences` | Update currency, timezone, or reminder settings | Bearer JWT | Yes |
| `GET` | `/api/v1/categories` | List active subscription categories | Bearer JWT | Yes |
| `GET` | `/api/v1/services` | List active catalog services | Bearer JWT | Yes |
| `GET` | `/api/v1/subscriptions` | List, filter, sort, and paginate owned subscriptions | Bearer JWT | Yes |
| `POST` | `/api/v1/subscriptions` | Create a new subscription record | Bearer JWT | Yes |
| `GET` | `/api/v1/subscriptions/:id` | Get single subscription details | Bearer JWT | Yes |
| `PATCH` | `/api/v1/subscriptions/:id` | Partial update of subscription terms/status | Bearer JWT | Yes |
| `DELETE` | `/api/v1/subscriptions/:id` | Soft-archive an owned subscription | Bearer JWT | Yes |
| `POST` | `/api/v1/subscriptions/:id/restore` | Restore a soft-archived subscription | Bearer JWT | Yes |
| `GET` | `/api/v1/subscriptions/:id/payments` | List payments for a specific subscription | Bearer JWT | Yes |
| `POST` | `/api/v1/subscriptions/:id/payments` | Record a manual payment for a subscription | Bearer JWT | Yes |
| `GET` | `/api/v1/payments` | List, filter, and sort all historical payments | Bearer JWT | Yes |
| `GET` | `/api/v1/payments/:id` | Fetch payment details with refund breakdown | Bearer JWT | Yes |
| `PATCH` | `/api/v1/payments/:id` | Correct a recorded payment under integrity guards | Bearer JWT | Yes |
| `GET` | `/api/v1/payments/:id/refunds` | List all refunds for a payment | Bearer JWT | Yes |
| `POST` | `/api/v1/payments/:id/refunds` | Record a partial or full refund with row-level lock | Bearer JWT | Yes |
| `GET` | `/api/v1/billing/overview` | Normalized recurring costs grouped by currency | Bearer JWT | Yes |
| `GET` | `/api/v1/billing/upcoming` | Upcoming renewals and unconfirmed overdue alerts | Bearer JWT | Yes |
| `GET` | `/api/v1/notifications` | List owned notifications with pagination and filters | Bearer JWT | Yes |
| `GET` | `/api/v1/notifications/unread-count` | Count owned unread notifications | Bearer JWT | Yes |
| `PATCH` | `/api/v1/notifications/:id/read` | Idempotently mark one owned notification read | Bearer JWT | Yes |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all owned notifications read | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/overview` | Gross, refund, and net spending totals with active counts | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/trends` | Monthly cash-flow time series with calendar gap-filling | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/categories` | Category spending breakdown with refunds and % of gross | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/subscriptions` | Subscription spending aggregates with server pagination | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/top-subscriptions` | Ranked top subscriptions by spending with limit control | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/billing-cycles` | Spending distribution and counts across billing cycles | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/payment-status` | Payment counts and amounts grouped by status | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/refunds` | Refund analytics with refund-to-payment ratios | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/report` | Composite multi-section financial summary report | Bearer JWT | Yes |
| `GET` | `/api/v1/analytics/export` | Formula-injection-sanitized streaming CSV report | Bearer JWT | Yes |

When PostgreSQL is absent or unavailable, database health safely returns HTTP 503 without crashing the API or exposing connection details.

## Backend Environment

```dotenv
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_dev
TEST_DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_test
ALLOW_DEMO_SEED=false

# Stage 4 Authentication Configuration
JWT_ACCESS_SECRET=your_minimum_32_character_random_secret
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
BCRYPT_COST=12
AUTH_RATE_LIMIT_MAX=10
COOKIE_SECURE=false
REMINDER_INTERVAL_MINUTES=60
REMINDER_BATCH_SIZE=500
```

`TEST_DATABASE_URL` is used only by integration tests. Demo seed additionally requires `NODE_ENV=development`, `ALLOW_DEMO_SEED=true`, and a connection to exactly `spendwise_dev`. Client-side `VITE_` values are public and must never contain secrets.

## Database Design

- `users` stores unique lowercase email, display name, and bcrypt password hash.
- `user_preferences` maintains one-to-one default settings per user (currency, timezone, reminder lead times).
- `auth_sessions` manages rotating refresh session UUIDs and SHA-256 token digests with replay detection.
- `categories` and `services` are shared catalogs; subscriptions also support custom service names.
- `subscriptions` stores current terms and is archived rather than routinely deleted.
- `payments` stores explicit historical events; `refunds` preserves partial/multiple refund history.
- `notifications` and recommendation links enforce same-user subscription ownership with composite foreign keys.
- Money uses `NUMERIC(12,2)` and is never totaled across currencies without exchange-rate data.

See the [ER Diagram](docs/ER_DIAGRAM.md), [Schema Reference](docs/DATABASE_SCHEMA.md), and [Normalization Analysis](docs/NORMALIZATION.md).

## Documentation

### Core & Stage 12 Deliverables
- [Final Comprehensive Project Report](docs/FINAL_PROJECT_REPORT.md)
- [REST API Reference](docs/API_REFERENCE.md)
- [User Guide & Application Manual](docs/USER_GUIDE.md)
- [Production Deployment & Operations Guide](docs/DEPLOYMENT_GUIDE.md)
- [Final Testing & QA Report](docs/FINAL_TESTING_REPORT.md)
- [Project Presentation & Live Demo Script](docs/PROJECT_DEMO_SCRIPT.md)

### Technical Specifications & DBMS Architecture
- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Functional and Non-Functional Requirements](docs/REQUIREMENTS.md)
- [User Workflows](docs/USER_WORKFLOWS.md)
- [High-Level System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Database Planning Record](docs/DATABASE_PLANNING.md)
- [Database Schema Reference](docs/DATABASE_SCHEMA.md)
- [Entity-Relationship Diagram](docs/ER_DIAGRAM.md)
- [Normalization Analysis (3NF/BCNF)](docs/NORMALIZATION.md)
- [PostgreSQL Setup on Windows](docs/DATABASE_SETUP.md)
- [Advanced DBMS Implementation](docs/ADVANCED_DBMS.md)
- [DBMS SQL Demonstrations](docs/DBMS_SQL_DEMONSTRATIONS.md)
- [Database Performance Report](docs/DATABASE_PERFORMANCE_REPORT.md)
- [DBMS Viva Preparation](docs/DBMS_VIVA_PREPARATION.md)
- [Subscription Management System](docs/SUBSCRIPTION_MANAGEMENT.md)
- [Payment Tracking & Billing Management](docs/PAYMENT_BILLING_MANAGEMENT.md)
- [Spending Analytics Engine](docs/SPENDING_ANALYTICS.md)
- [DBMS Analytics SQL Queries](docs/ANALYTICS_SQL_QUERIES.md)
- [Dashboard Frontend & Integration](docs/DASHBOARD_FRONTEND.md)
- [Renewal Reminders & Notifications](docs/RENEWAL_NOTIFICATIONS.md)
- [AI-Powered Cost Optimization](docs/AI_COST_OPTIMIZATION.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Architecture Decisions (ADRs 001–040)](docs/ARCHITECTURE_DECISIONS.md)
- [General Local Setup](docs/LOCAL_SETUP.md)

## Roadmap

1. Project Planning & Requirements — **complete**
2. System Architecture & Project Setup — **complete**
3. Database Design & PostgreSQL Implementation — **complete**
4. Authentication & Account Management — **complete**
5. Subscription Management — **complete**
6. Payment Tracking & Billing Management — **complete**
7. Spending Analytics & SQL Reporting — **complete**
8. Frontend Dashboard & Integration — **complete**
9. Renewal Reminders & Notifications — **complete**
10. AI-Powered Cost Optimization — **complete**
11. Advanced DBMS Implementation & Optimization — **complete**
12. Testing, Security, Deployment & Documentation — **complete**

## Current Boundaries

- Data entry remains manual; there are no bank or payment-provider connections.
- The application cannot make payments or cancel external subscriptions.
- User accounts, JWT auth, rotating sessions, and user isolation are active.
- Subscription CRUD, payment history, refund recording, and forward billing projections are active.
- Spending analytics, multi-period aggregations, CTE-based double-counting prevention, calendar series generation, and CSV export are active.
- The dashboard visualizes backend-authoritative totals; browser chart numbers are presentation-only and exact values remain visible in text/tables.
- Renewal reminders and the in-app notification center operate independently from recommendations.
- The integration test suite may rebuild only the dedicated `spendwise_test` schema.
- Deterministic, PostgreSQL-backed recommendations are active, advisory, currency-separated, and grounded in stored records; optional external AI is disabled.
