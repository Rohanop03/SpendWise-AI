# Stage 2 Architecture Decisions

This record captures technical foundation decisions made during Stage 2. It complements the conceptual architecture in [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) and does not redefine the planned business requirements.

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

## Deferred Decisions

- Physical database schema, migrations, constraints, and seed policy: Stage 3
- JWT transport, refresh, revocation, and protected-route middleware: Stage 4
- Business validation and ownership-aware repositories: Stages 4–6
- Production hosting, TLS termination, monitoring, backups, and recovery: Stage 12
