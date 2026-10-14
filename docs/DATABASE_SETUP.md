# PostgreSQL Setup on Windows

Stage 3 requires PostgreSQL for live migrations, seeds, and integration tests. The basic Express health endpoint can still run without it.

## Environment status recorded during Stage 3

On 15 October 2026, this workstation was verified with PostgreSQL 18.6, the non-superuser application role `spendwise_app`, and separate `spendwise_dev` and `spendwise_test` databases. Migration `001_initial_schema` and the reference catalog seed were applied to development. The guarded live integration suite passed against `spendwise_test`, and the Express database-health endpoint returned HTTP 200. Credentials remain only in the ignored local `server/.env` file.

## 1. Install PostgreSQL

Use the [official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/). PostgreSQL 18 is the current supported major release at the time of this guide; the schema also uses features available in supported PostgreSQL 14–17 releases.

1. Download the EDB interactive installer from the official page.
2. Run it with the administrator approval required by your Windows account.
3. Select **PostgreSQL Server**, **pgAdmin 4**, and **Command Line Tools**. Stack Builder is optional for this project.
4. Keep the proposed program directory, normally `C:\Program Files\PostgreSQL\18`.
5. Choose a local data directory with enough space. Keeping database data outside a OneDrive-synchronized project folder is recommended.
6. Set a strong password for the administrative `postgres` role and store it in a password manager. This is not the application password.
7. Use port `5432` if it is free; otherwise record the selected port and use it in both connection URLs.
8. Complete the installation and leave the PostgreSQL Windows service enabled.

Do not commit either database password. Do not use the `postgres` superuser in the application.

## 2. Verify the installation

Open a new PowerShell window and run:

```powershell
Get-Service -Name '*postgres*'
psql --version
pg_isready -h localhost -p 5432
```

If `psql` is not on `PATH`, call it by its installed path without changing system settings:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --version
```

Replace `18` with the installed major version. To add the tools to `PATH`, use **System Properties → Environment Variables → Path → New**, add the version's `bin` folder, and then open a new terminal. This is optional and must be done manually.

In pgAdmin, expand **Servers**, connect to the local PostgreSQL server, and open **Tools → Query Tool**. In SQL Shell (`psql`), accept the localhost, database, port, and username defaults as appropriate, then enter the administrative password interactively.

Verify either tool with:

```sql
SELECT current_database(), current_user, version();
```

## 3. Create the dedicated role and databases

Connect to the administrative `postgres` database as the `postgres` role:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres
```

At the `psql` prompt, create a non-superuser application role and set its password interactively so it does not appear in shell history:

```sql
CREATE ROLE spendwise_app
  WITH LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION;

\password spendwise_app

CREATE DATABASE spendwise_dev OWNER spendwise_app;
CREATE DATABASE spendwise_test OWNER spendwise_app;
```

If an object already exists, inspect it rather than blindly dropping it:

```sql
\du spendwise_app
\l spendwise_dev
\l spendwise_test
```

The role owns each local database, so it can run migrations. The separate test database exists because `npm run test:db` deliberately rebuilds the `public` schema. Never point `TEST_DATABASE_URL` at `spendwise_dev` or production.

## 4. Configure private environment values

From the repository root:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server\.env`:

```dotenv
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_dev
TEST_DATABASE_URL=postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_test
ALLOW_DEMO_SEED=false
```

Percent-encode reserved URL characters in the password—for example, `@` becomes `%40`, `:` becomes `%3A`, and `/` becomes `%2F`. `server/.env` is Git-ignored; only the placeholder `.env.example` is tracked.

For a temporary PowerShell session, values can instead be set without writing a file:

```powershell
$env:DATABASE_URL = 'postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_dev'
$env:TEST_DATABASE_URL = 'postgresql://spendwise_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/spendwise_test'
```

## 5. Check, migrate, and seed development

Run from the repository root:

```powershell
npm run db:check
npm run db:migrate
npm run db:seed
```

- `db:check` prints the connected database, role, and PostgreSQL version, never the URL or password.
- `db:migrate` applies unapplied `.sql` files in deterministic order and records their SHA-256 checksums in `schema_migrations`.
- `db:seed` idempotently inserts only the shared category and service catalogs. It never invents service prices.

The runner serializes concurrent migration attempts with a PostgreSQL advisory transaction lock. Every migration is atomic. It refuses to continue if a previously applied file is missing or its checksum changed. Applied migrations are immutable; add a new numbered migration for later changes.

## 6. Optional fictional demo data

Demo data is blocked unless all three protections hold: `NODE_ENV=development`, `ALLOW_DEMO_SEED=true`, and the connected database is exactly `spendwise_dev`.

```powershell
$env:NODE_ENV = 'development'
$env:ALLOW_DEMO_SEED = 'true'
npm run db:seed:demo
```

This adds only fictional `.invalid` users, subscriptions, payments, and a notification. The fixture hash is not a real password and is not intended for login. Set `ALLOW_DEMO_SEED=false` again after use. The command is repeatable and does not duplicate the fixtures.

## 7. Run database integration tests

```powershell
npm run test:db
```

The test suite reads only `TEST_DATABASE_URL`. Before destructive setup, it queries `current_database()` and refuses every name except `spendwise_test`. It then drops and recreates only that database's `public` schema to validate a fresh migration. All data in `spendwise_test.public` is disposable.

When `TEST_DATABASE_URL` is absent, the suite reports a skipped integration test rather than claiming PostgreSQL passed. Unit and HTTP tests remain available through `npm run test`.

## 8. Inspect the live schema

Connect as the application role:

```powershell
psql -h localhost -p 5432 -U spendwise_app -d spendwise_dev
```

Then inspect and validate:

```sql
SELECT current_database(), current_user, version();
\dt
\d users
\d subscriptions
\d payments

SELECT COUNT(*) AS categories FROM categories;
SELECT COUNT(*) AS services FROM services;
SELECT migration_id, checksum, applied_at
FROM schema_migrations
ORDER BY migration_id;
```

The reference seed should produce seven categories and seven services. Use the examples in [SQL_QUERY_EXAMPLES.md](SQL_QUERY_EXAMPLES.md) for joins and constraint demonstrations.

## 9. Verify the complete connection chain

Start the backend and query its existing endpoints:

```powershell
npm run dev:server
```

In another terminal:

```powershell
curl.exe -i http://localhost:5000/api/v1/health
curl.exe -i http://localhost:5000/api/v1/health/database
```

With valid `DATABASE_URL` configuration, the database endpoint returns HTTP 200 and `{"status":"ok","database":"connected"}`. If PostgreSQL is stopped or credentials are invalid, it returns HTTP 503 and `{"status":"error","database":"unavailable"}` without exposing connection details or crashing Express.

## Troubleshooting

### `psql` is not recognized

Use the full executable path shown above, locate the installed major-version directory, or manually add its `bin` directory to `PATH` and open a new terminal.

### Connection refused

Check `Get-Service -Name '*postgres*'`, start the intended PostgreSQL service through Windows Services if authorized, confirm the port, and run `pg_isready`.

### Password authentication failed

Confirm the URL uses `spendwise_app`, percent-encode reserved password characters, and reset the role password with `\password spendwise_app` while connected as an administrator. Never paste the private URL into issue reports or commits.

### Database does not exist or permission denied

Use `\l` and `\du` as the administrator. Confirm both databases are owned by `spendwise_app`. Do not work around ownership problems by configuring the application as a superuser.

### Migration checksum mismatch

Do not edit an applied migration. Restore the original file and create the next numbered migration. The mismatch is an intentional drift safeguard.

### Integration test refuses the database

This is a safety feature. Set `TEST_DATABASE_URL` to the separate database named exactly `spendwise_test`; never weaken the guard to use development data.
