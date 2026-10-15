# Local Setup Guide

This guide runs the Stage 11 SpendWise AI application on Windows with Visual Studio Code and PowerShell. PostgreSQL is optional for the basic frontend and API health check, but required for migrations, seeds, database tests, advanced demonstrations, benchmarks, and successful database health.

## 1. Required Software

- Git
- Visual Studio Code
- Node.js `22.19.0` as recorded in `.nvmrc`, or another compatible maintained release satisfying `>=22.13.0`
- npm `10` or newer
- A modern browser
- PostgreSQL 14 or newer for Stage 3 database work

Confirm the installed tools from PowerShell:

```powershell
git --version
node --version
npm --version
```

The Stage 2 implementation was verified with Node.js `v22.19.0` and npm `10.9.3`.

## 2. Open the Repository

```powershell
cd C:\path\to\SpendWise-AI
git branch --show-current
git status
code .
```

The expected development branch is `develop`. Do not initialize another Git repository inside this folder.

## 3. Install Dependencies

Run the installation once from the repository root:

```powershell
npm install
```

npm workspaces install the root tooling and both application workspaces. The repository uses one root `package-lock.json`; do not run separate installs to create workspace lockfiles.

## 4. Configure the Frontend Environment

Copy the safe example:

```powershell
Copy-Item client\.env.example client\.env
```

The default value is:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Variables beginning with `VITE_` are included in browser code. Never place passwords, database URLs, signing keys, or private API keys in `client/.env`.

The frontend also has the same localhost API URL as a development fallback, so copying this file is recommended but not required for the default ports.

## 5. Configure the Backend Environment

Copy the server example:

```powershell
Copy-Item server\.env.example server\.env
```

The supported variables are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime behavior: `development`, `test`, or `production` |
| `PORT` | `5000` | Express HTTP port |
| `CORS_ORIGIN` | `http://localhost:5173` | Browser origin permitted by CORS |
| `DATABASE_URL` | unset | Optional PostgreSQL connection URL |
| `TEST_DATABASE_URL` | unset | Dedicated `spendwise_test` integration-test URL |
| `ALLOW_DEMO_SEED` | `false` | Explicit guard for fictional development seeds |
| `JWT_ACCESS_SECRET` | unset | Secret key of at least 32 characters for signing JWT access tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | JWT expiration duration (e.g. `15m`, `1h`) |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Refresh session duration in days (1–30) |
| `BCRYPT_COST` | `12` | Bcrypt hashing cost factor (10–15) |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max auth requests per 15-minute window per IP |
| `COOKIE_SECURE` | `false` | Set to `false` for localhost development; required `true` in production |

The example `DATABASE_URL` is commented out deliberately. Leave it unset when PostgreSQL is not available. The backend and `/api/v1/health` still work; `/api/v1/health/database` returns HTTP 503 as designed. When starting authentication routes, `JWT_ACCESS_SECRET` is required.

Actual `.env` files are ignored by Git. Commit only `.env.example` files, never local credentials.

## 6. Start the Full Application

From the repository root:

```powershell
npm run dev
```

This starts two labeled development processes:

- React frontend: `http://localhost:5173`
- Express API: `http://localhost:5000`

Vite provides frontend hot module replacement. Node.js watch mode restarts the backend when its source changes. Stop both with `Ctrl+C`.

To run either side independently:

```powershell
npm run dev:client
npm run dev:server
```

Run those commands in separate terminals when both are needed.

## 7. Test the API Health Endpoints

With the backend running, use PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
```

Expected result:

```json
{
  "status": "ok",
  "service": "spendwise-api"
}
```

Check the database endpoint while PostgreSQL is unconfigured:

```powershell
curl.exe -i http://localhost:5000/api/v1/health/database
```

Expected result is HTTP 503 with a safe body:

```json
{
  "status": "error",
  "database": "unavailable"
}
```

An unknown endpoint, such as `/api/v1/unknown`, returns HTTP 404 and a JSON error response.

## 8. Verify Frontend–Backend Connectivity

1. Start both processes with `npm run dev`.
2. Open `http://localhost:5173`.
3. Confirm the landing page displays **API online** and **Backend connected**.
4. Stop only the backend.
5. Refresh the browser.
6. Confirm the landing page remains usable and displays **API unavailable**.

The page performs one health request when it loads. It does not continuously poll the backend.

## 9. PostgreSQL Setup

Follow the complete [PostgreSQL Setup Guide](DATABASE_SETUP.md). It covers the Windows installer, pgAdmin/psql access, dedicated `spendwise_app` role, separate `spendwise_dev` and `spendwise_test` databases, private URLs, migrations, seeds, live inspection, and troubleshooting.

After configuration, the normal initialization sequence is:

```powershell
npm run db:check
npm run db:migrate
npm run db:seed
npm run test:db
```

The integration suite destructively rebuilds only `spendwise_test.public` and refuses every other database name.

## 10. Quality and Build Commands

Run these from the repository root:

```powershell
npm run lint
npm run test
npm run test:db
npm run db:advanced:verify
npm run db:demo
npm run db:benchmark
npm run format:check
npm run build
```

- `lint` checks frontend, backend, tests, and shared JavaScript configuration.
- `test` runs backend HTTP/database unit tests and skips the integration suite when `TEST_DATABASE_URL` is absent.
- `test:db` runs the real PostgreSQL suite against the guarded `spendwise_test` database.
- `db:advanced:verify` verifies the Stage 11 functions, procedure, trigger, views, audit table, and index.
- `db:demo` uses isolated test rows to demonstrate ACID, isolation levels, serialization failure, and deadlock detection.
- `db:benchmark` creates and cleans a 50,000-row test fixture and compares actual execution plans.
- `format:check` checks implementation and configuration formatting while preserving manually formatted project documentation.
- `build` creates a production frontend bundle in `client/dist/`.

The generated `dist`, dependency, coverage, log, and local environment files are ignored by Git.

## 11. Common Troubleshooting

### PowerShell blocks `npm.ps1`

Use `npm.cmd` for the same command, or configure an execution policy appropriate for your development machine:

```powershell
npm.cmd run dev
```

Do not weaken organization-managed security policy without authorization.

### Port 5000 or 5173 is already in use

Stop the other process or change the corresponding configuration. If the backend port changes, update `VITE_API_BASE_URL`. If the frontend origin changes, update `CORS_ORIGIN`.

### The page reports that the API is unavailable

- Confirm `npm run dev:server` is still running.
- Open `http://localhost:5000/api/v1/health` directly.
- Confirm `VITE_API_BASE_URL` includes `/api/v1`.
- Confirm `CORS_ORIGIN` exactly matches the frontend origin.
- Restart Vite after changing a frontend environment file.

### Database health returns HTTP 503

This is expected when `DATABASE_URL` is absent, PostgreSQL is stopped, the database does not exist, or credentials are incorrect. The basic API remains healthy. Review local PostgreSQL service status and the private `server/.env` value without sharing it in logs or commits.

### Environment configuration prevents startup

The backend deliberately rejects invalid ports, origins, runtime names, and malformed PostgreSQL URLs. Compare the local file with `server/.env.example` and correct the value.

### Dependencies or lockfile appear inconsistent

Run `npm install` from the repository root. Do not maintain separate `client` or `server` lockfiles.

## 12. Dashboard Verification

After signing in, open `http://localhost:5173/dashboard`. The dashboard defaults to the account's preferred currency and the last 12 months. Currency and period selections are reflected in the URL, so a filtered dashboard can be refreshed without losing its selection.

If charts remain empty, confirm that the account owns subscriptions and that completed payments were explicitly recorded. Current recurring estimates can appear without payment history; historical spending cannot. The application intentionally does not fabricate transactions or convert currencies.

Recharts is installed in the client workspace. If dependencies or the lockfile are stale, run `npm install` once from the repository root.

## 13. Current Stage Boundaries

Stages 1–11 provide account authentication, subscription management, payment/refund records, billing projections, SQL analytics, the dashboard, database-backed in-app reminders, deterministic cost recommendations, and advanced PostgreSQL demonstrations/optimization. External notification delivery, an external LLM provider, bank/payment-provider integrations, and production deployment remain outside the current stage.

## 14. Reminder Worker

Run the API and reminder worker as separate processes after applying migrations:

```powershell
npm run dev:server
npm run reminders:worker
```

Use `npm run reminders:run-once` for a single safe scan. Configure `REMINDER_INTERVAL_MINUTES` and `REMINDER_BATCH_SIZE` in the private server environment. Stop the recurring worker with `Ctrl+C`; it waits for an active scan and closes its pool. See [Renewal Reminders and Notifications](RENEWAL_NOTIFICATIONS.md).
