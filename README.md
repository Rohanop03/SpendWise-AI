# SpendWise AI

> Smart Subscription Tracking & AI-Powered Cost Optimization

SpendWise AI is a full-stack subscription management and cost-optimization project. The completed Stage 2 foundation provides a responsive React application, a versioned Express API, real frontend-to-backend health integration, and optional PostgreSQL connection infrastructure.

The broader product will help users record subscriptions and payments, understand recurring costs, monitor renewals, and receive explainable optimization suggestions grounded in their own stored data. Those business capabilities remain planned for later stages and are not represented as implemented today.

## Current Status

**Stage 2 of 12 — System Architecture & Project Setup**

Implemented in this stage:

- React 19 application powered by Vite 8
- Tailwind CSS 4 using its Vite plugin
- React Router home and not-found routes
- Reusable Axios client and one-time backend connection check
- Responsive SaaS-style starter interface with accessible status messaging
- Express 5 application with `/api/v1` routing
- Application/process separation and graceful shutdown
- Backend and database health endpoints
- Optional lazy PostgreSQL connection pool through `pg`
- Validated environment configuration, restricted CORS, 404 handling, and centralized error handling
- npm workspaces with shared development, lint, test, formatting, and build commands
- Deterministic backend HTTP tests using Node.js test runner and Supertest

Not yet implemented: accounts, authentication, database schema, subscriptions, payments, analytics, reminders, notifications, or AI recommendations.

## Technology Stack

| Layer | Current foundation | Planned later |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Router, Axios | Recharts and business feature interfaces |
| Backend | Node.js, Express, REST API, CORS, environment configuration | JWT, bcrypt, domain services |
| Database | PostgreSQL connection pooling through raw `pg` | Normalized schema, migrations, reports, advanced DBMS objects |
| Quality | npm workspaces, ESLint, Prettier, Node test runner, Supertest | Broader integration, component, accessibility, and end-to-end coverage |

No ORM is used or planned. Direct PostgreSQL and SQL work are central DBMS objectives.

## Project Structure

```text
SpendWise-AI/
├── client/
│   ├── src/
│   │   ├── api/          # Axios client and API functions
│   │   ├── components/   # Reusable presentation components
│   │   ├── hooks/        # Reusable React behavior
│   │   ├── layouts/      # Shared application shell
│   │   ├── pages/        # Route-level views
│   │   ├── routes/       # React Router configuration
│   │   └── styles/       # Tailwind entry point and global styles
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── config/       # Environment and PostgreSQL configuration
│   │   ├── controllers/  # HTTP response handlers
│   │   ├── middleware/   # 404 and centralized error handling
│   │   ├── routes/       # Versioned API routing
│   │   ├── services/     # Application health behavior
│   │   ├── app.js        # Testable Express application
│   │   └── index.js      # HTTP process lifecycle
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── docs/
├── eslint.config.js
├── package.json
└── package-lock.json
```

Only directories with Stage 2 responsibilities are present. Future domain folders should be added when their features are implemented.

## Local Requirements

- Node.js `22.19.0` from `.nvmrc`, or a compatible maintained release satisfying `>=22.13.0`
- npm `10` or newer
- Git
- PostgreSQL is optional until database connectivity is being verified

The current foundation was verified with Node.js `v22.19.0` and npm `10.9.3` on Windows.

## Installation

From the repository root in PowerShell:

```powershell
npm install
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/v1/health`

The default application runs without PostgreSQL. Keep `DATABASE_URL` commented out when no local database is available.

See the [Windows Local Setup Guide](docs/LOCAL_SETUP.md) for PostgreSQL setup, endpoint verification, and troubleshooting.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install root, client, and server workspace dependencies |
| `npm run dev` | Start the frontend and backend together |
| `npm run dev:client` | Start only Vite on port 5173 |
| `npm run dev:server` | Start only Express on port 5000 with watch mode |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run backend foundation tests |
| `npm run format` | Format implementation and configuration files |
| `npm run format:check` | Check formatting without modifying files |
| `npm run build` | Build the frontend production bundle |

## API Endpoints

All APIs use the `/api/v1` prefix.

| Method | Endpoint | Purpose | Database required |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Verify that Express is running | No |
| `GET` | `/api/v1/health/database` | Run `SELECT 1` through the PostgreSQL pool | Yes for HTTP 200 |

Successful backend health response:

```json
{
  "status": "ok",
  "service": "spendwise-api"
}
```

If PostgreSQL is absent or unavailable, the database endpoint safely returns HTTP 503 without crashing the API or exposing connection details.

## Environment Configuration

Frontend configuration belongs in `client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Backend configuration belongs in `server/.env`:

```dotenv
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
# DATABASE_URL=postgresql://local_user:local_password@localhost:5432/spendwise_dev
```

Only `.env.example` files are tracked. `VITE_` variables are public browser configuration and must never contain secrets.

## Documentation

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Functional and Non-Functional Requirements](docs/REQUIREMENTS.md)
- [User Workflows](docs/USER_WORKFLOWS.md)
- [High-Level System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Preliminary Database Planning](docs/DATABASE_PLANNING.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Stage 2 Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)
- [Windows Local Setup Guide](docs/LOCAL_SETUP.md)

## Roadmap

1. Project Planning & Requirements — **complete**
2. System Architecture & Project Setup — **current stage**
3. Database Design & PostgreSQL Setup
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

- Data entry will remain manual in the initial product.
- The application does not connect to banks or payment providers.
- It does not make payments or cancel subscriptions.
- No database schema, migration, seed, or fabricated financial record exists in Stage 2.
- Authentication and authorization begin in Stage 4 after the Stage 3 schema is finalized.
- Recommendations will be advisory estimates and will never claim unobserved usage or guaranteed savings.
