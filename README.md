# SpendWise AI

> Smart Subscription Tracking & AI-Powered Cost Optimization

SpendWise AI is a full-stack subscription management and cost-optimization project. Stage 3 adds a normalized PostgreSQL schema, transactional SQL migrations, safe catalog/demo seeds, pooled query and transaction utilities, and real-database integration tests to the Stage 2 React and Express foundation.

The product will eventually help users record subscriptions and payments, understand recurring costs, monitor renewals, and receive explainable optimization suggestions. Stage 3 defines the data model for those workflows but does not expose account or business APIs.

## Current Status

**Stage 3 of 12 — Database Design & PostgreSQL Implementation**

Implemented:

- React 19/Vite 8 frontend and Express 5 `/api/v1` backend from Stage 2
- Reusable lazy PostgreSQL pool and single-client transaction helper using `pg`
- Ten normalized domain tables plus checksum-based migration tracking
- Case-insensitive user email and catalog uniqueness
- Ownership-aware notification and recommendation relationships
- Current subscription terms separated from historical payments and refunds
- Non-destructive subscription archival policy
- Atomic, ordered SQL migration runner with advisory locking and drift detection
- Idempotent reference catalog seed and guarded fictional demo seed
- Unit tests plus a safely isolated real PostgreSQL integration suite
- Windows installation, schema, ER, normalization, and SQL-query documentation

Not implemented yet: registration/login, JWT authorization, subscription/payment REST APIs, dashboard analytics, schedulers, notification delivery, or recommendation generation.

## Technology Stack

| Layer | Implemented | Planned later |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Router, Axios | Business feature interfaces and charts |
| Backend | Node.js, Express, REST API foundation, CORS, environment validation | Authentication and domain repositories/services |
| Database | PostgreSQL, raw parameterized SQL with `pg`, migrations, seeds, normalized schema | Advanced reports, views, and measured optimization |
| Quality | npm workspaces, ESLint, Prettier, Node test runner, Supertest, PostgreSQL integration tests | Component, accessibility, and end-to-end coverage |

No ORM is used. Direct PostgreSQL and SQL are central DBMS objectives.

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
| `npm run test:db` | Rebuild and test only the configured `spendwise_test` database |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run all server tests; DB integration skips without `TEST_DATABASE_URL` |
| `npm run format` | Format implementation, configuration, and documentation |
| `npm run format:check` | Check formatting without modifying files |
| `npm run build` | Build the frontend production bundle |

`test:db` is destructive only to `spendwise_test.public` and refuses any other database name.

## API Endpoints

| Method | Endpoint | Purpose | Database required |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Verify Express is running | No |
| `GET` | `/api/v1/health/database` | Run `SELECT 1` through the pool | Yes for HTTP 200 |

When PostgreSQL is absent or unavailable, database health safely returns HTTP 503 without crashing the API or exposing connection details.

## Backend Environment

```dotenv
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_dev
TEST_DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_test
ALLOW_DEMO_SEED=false
```

`TEST_DATABASE_URL` is used only by integration tests. Demo seed additionally requires `NODE_ENV=development`, `ALLOW_DEMO_SEED=true`, and a connection to exactly `spendwise_dev`. Client-side `VITE_` values are public and must never contain secrets.

## Database Design

- `users` and one-to-one `user_preferences` prepare for Stage 4 accounts.
- `categories` and `services` are shared catalogs; subscriptions also support custom service names.
- `subscriptions` stores current terms and is archived rather than routinely deleted.
- `payments` stores explicit historical events; `refunds` preserves partial/multiple refund history.
- `notifications` and recommendation links enforce same-user subscription ownership with composite foreign keys.
- Money uses `NUMERIC(12,2)` and is never totaled across currencies without exchange-rate data.

See the [ER Diagram](docs/ER_DIAGRAM.md), [Schema Reference](docs/DATABASE_SCHEMA.md), and [Normalization Analysis](docs/NORMALIZATION.md).

## Documentation

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Functional and Non-Functional Requirements](docs/REQUIREMENTS.md)
- [User Workflows](docs/USER_WORKFLOWS.md)
- [High-Level System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Database Planning Record](docs/DATABASE_PLANNING.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [ER Diagram](docs/ER_DIAGRAM.md)
- [Normalization](docs/NORMALIZATION.md)
- [PostgreSQL Setup on Windows](docs/DATABASE_SETUP.md)
- [SQL Query Examples](docs/SQL_QUERY_EXAMPLES.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)
- [General Local Setup](docs/LOCAL_SETUP.md)

## Roadmap

1. Project Planning & Requirements — **complete**
2. System Architecture & Project Setup — **complete**
3. Database Design & PostgreSQL Implementation — **current stage**
4. Authentication & Account Management
5. Subscription Management
6. Payment Tracking & Billing Management
7. Spending Analytics & SQL Reporting
8. Frontend Dashboard & Integration
9. Renewal Reminders & Notifications
10. AI-Powered Cost Optimization
11. Advanced DBMS Implementation
12. Testing, Deployment & Documentation

## Current Boundaries

- Data entry remains manual; there are no bank or payment-provider connections.
- The application cannot make payments or cancel external subscriptions.
- Database tables are implemented, but no user registration or business CRUD APIs exist yet.
- Authentication and authorization begin in Stage 4.
- The Stage 3 test suite may rebuild only the dedicated `spendwise_test` schema.
- Recommendations remain advisory future records and must be grounded in stored data.
