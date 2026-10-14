# Local Setup Guide

This guide runs the Stage 2 SpendWise AI foundation on Windows with Visual Studio Code and PowerShell. PostgreSQL is optional for the basic frontend and API health check.

## 1. Required Software

- Git
- Visual Studio Code
- Node.js `22.19.0` as recorded in `.nvmrc`, or another compatible maintained release satisfying `>=22.13.0`
- npm `10` or newer
- A modern browser
- PostgreSQL only when verifying the optional database connection endpoint

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

The example `DATABASE_URL` is commented out deliberately. Leave it unset when PostgreSQL is not available. The backend and `/api/v1/health` still work; `/api/v1/health/database` returns HTTP 503 as designed.

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

## 9. Optional PostgreSQL Setup

Install PostgreSQL using the official Windows installer or use an existing local PostgreSQL instance. Ensure its command-line tools are available on `PATH` if you intend to use PowerShell rather than pgAdmin.

Create an empty local database through pgAdmin or with a command such as:

```powershell
createdb -U postgres spendwise_dev
```

Stage 2 creates no tables, migrations, roles, or seed data. Use a local PostgreSQL account you control and update `server/.env` with its real values:

```dotenv
DATABASE_URL=postgresql://your_local_user:your_url_encoded_password@localhost:5432/spendwise_dev
```

Restart the backend after changing `.env`, then run:

```powershell
curl.exe -i http://localhost:5000/api/v1/health/database
```

A successful connection returns HTTP 200:

```json
{
  "status": "ok",
  "database": "connected"
}
```

The connectivity query is `SELECT 1`; it does not create or modify database objects.

## 10. Quality and Build Commands

Run these from the repository root:

```powershell
npm run lint
npm run test
npm run format:check
npm run build
```

- `lint` checks frontend, backend, tests, and shared JavaScript configuration.
- `test` runs deterministic backend HTTP tests with mocked database behavior; no live database is required.
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

## 12. Stage 2 Boundaries

The current application provides only a landing page, routing foundation, API health endpoints, and PostgreSQL connection infrastructure. It does not include accounts, authentication, subscriptions, payments, analytics, reminders, recommendations, database tables, migrations, or seed data.
