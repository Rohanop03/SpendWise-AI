# SpendWise AI

> Smart Subscription Tracking & AI-Powered Cost Optimization

SpendWise AI is a full-stack subscription management and cost-optimization project. Stage 4 completes user authentication and account management, delivering atomic registration with bcrypt password hashing, short-lived JWT access tokens, rotating PostgreSQL-backed refresh sessions in `auth_sessions`, HTTP-only cookie transport with CSRF defenses, replay attack detection, transparent client-side session recovery via Axios interceptors, protected user profile and preference management, rate limiting, and cross-user isolation.

The product will eventually help users record subscriptions and payments, understand recurring costs, monitor renewals, and receive explainable optimization suggestions. Stage 4 secures account identities and preferences, establishing the prerequisite foundation for user-owned subscription tracking in Stage 5.

## Current Status

**Stage 4 of 12 — User Authentication & Account Management**

Implemented:

- React 19 / Vite 8 frontend with protected routes, public-only routes, session initialization, and responsive account views
- Registration and login workflows with client-side validation and accessible password toggle fields
- Bcrypt password hashing (cost factor 12) with constant-time dummy hash verification preventing email enumeration timing attacks
- Short-lived JWT access tokens (15m expiration, strictly validated `sub`, `sid`, `iat`, `exp` claims)
- Rotating PostgreSQL-backed refresh sessions in `auth_sessions` with SHA-256 hash storage (raw tokens never stored)
- Token reuse / replay attack detection that revokes all compromised sessions immediately
- HTTP-only, SameSite=Lax cookie transport scoped to `/api/v1/auth` with strict CSRF verification (`Origin` and `X-Requested-With`)
- Transparent Axios interceptor automatic session recovery on expired access tokens for protected requests (e.g. `/auth/me`, `/users/me`)
- Account management: profile updates and personal preferences (`/api/v1/users/me`, `/api/v1/users/me/preferences`)
- Secure password changes revoking all active sessions across all devices
- Credential rate limiting on registration and login endpoints via `express-rate-limit`
- Clean separation of React Context (`authContext.js`), custom hooks (`useAuth.js`), and provider components (`AuthContext.jsx`)
- Vitest unit tests for client authentication and interceptor recovery
- Isolated PostgreSQL integration tests verifying all auth workflows and constraints on `spendwise_test`

Not implemented yet: subscription CRUD, payment tracking, dashboard analytics, renewal scheduler jobs, notification center, or AI recommendations.

## Technology Stack

| Layer | Implemented | Planned later |
| --- | --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Vitest, Testing Library | Recharts, subscription forms, and dashboard analytics |
| Backend | Node.js 22, Express 5, bcrypt, jsonwebtoken, cookie-parser, express-rate-limit, zod, raw `pg` | Domain repositories for subscriptions and payments |
| Database | PostgreSQL 18.6, raw parameterized SQL with `pg`, migrations `001_initial_schema` and `002_auth_sessions` | Advanced reports, views, and measured DBMS optimization |
| Quality | npm workspaces, ESLint 9, Prettier, Node test runner, Vitest, Supertest, PostgreSQL integration tests | End-to-end browser testing |

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
3. Database Design & PostgreSQL Implementation — **complete**
4. Authentication & Account Management — **complete**
5. Subscription Management — **next stage**
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
- User accounts, JWT auth, rotating sessions, and user isolation are active.
- Subscription CRUD, payments, and forward projections remain owned by Stages 5 and 6.
- The integration test suite may rebuild only the dedicated `spendwise_test` schema.
- Recommendations remain advisory future records and must be grounded in stored data.
