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

## Deferred Decisions

- JWT transport, refresh, revocation, and protected-route middleware: Stage 4
- Business validation and ownership-aware repositories: Stages 4–6
- Cross-row refund-total enforcement: Stage 6 transactional payment service
- Row-level security reconsideration and advanced DBMS objects: Stage 11
- Production hosting, TLS termination, monitoring, backups, and recovery: Stage 12
