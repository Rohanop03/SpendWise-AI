# SpendWise AI: Smart Subscription Manager & Cost Optimization Engine
## Final Comprehensive Technical Project Report

**Academic & Technical Portfolio Project**  
**Institution:** University DBMS & Full-Stack Software Engineering Capstone  
**Author / Engineering Lead:** Rohan Patil  
**Repository:** [https://github.com/Rohanop03/SpendWise-AI](https://github.com/Rohanop03/SpendWise-AI)  
**Version:** 1.0.0 (Stage 12 Milestone Completion)  
**Database Technology:** PostgreSQL 18.6 / 16.x  
**Backend Platform:** Node.js 22 LTS, Express 5 (ES Modules)  
**Frontend Platform:** React 19, Vite 8, Tailwind CSS 4, React Router 7  

---

## 1. Executive Summary

Modern consumers and businesses face mounting subscription fatigue, recurring billing opacity, hidden price hikes, and unmonitored trial rollovers. **SpendWise AI** is a production-grade, database-driven financial management platform designed to track recurring subscriptions, maintain an immutable payment and refund ledger, calculate forward-looking cash flow projections, deliver proactive renewal reminders, and generate explainable, deterministic cost-optimization recommendations.

Unlike consumer applications that rely entirely on fragile third-party aggregators or black-box LLMs prone to financial hallucination, SpendWise AI anchors every calculation in rigorous PostgreSQL relational algebra, strict ACID transactions, and deterministic analytical rules. An optional isolated AI explanation adapter enriches recommendations with clear natural language context without ever mutating underlying financial metrics.

This report documents the architectural principles, relational database design, security hardening, full-stack implementation, automated testing matrices, deployment readiness, and empirical performance benchmarks achieved across the complete 12-stage engineering lifecycle.

---

## 2. Project Architecture & System Overview

SpendWise AI is structured as a hardened monorepo utilizing npm workspaces, cleanly isolating domain logic, persistence layers, and presentation interfaces.

```mermaid
flowchart TD
    User["Client Browser (React 19 SPA)"]
    ViteProxy["Vite / Reverse Proxy (Nginx/Render)"]
    Express["Express 5 REST API (:5000)"]
    SecurityMiddleware["Security & Auth Middleware (CORS, RateLimit, CSP, JWT)"]
    Services["Service Layer (Subscription, Billing, Analytics, AI Engine)"]
    Repositories["Data Access Layer (Parameterized Queries & Transactions)"]
    Postgres[("PostgreSQL 18.6 Relational Engine")]
    Worker["Background Reminder Worker (:60m cadence)"]

    User <-->|HTTPS / JSON / HttpOnly Cookie| ViteProxy
    ViteProxy <--> Express
    Express --> SecurityMiddleware
    SecurityMiddleware --> Services
    Services <--> Repositories
    Repositories <-->|pg Connection Pool (ACID)| Postgres
    Worker <-->|Advisory Locks & Stored Procedure| Postgres
```

### Full-Stack Specifications
- **Client Workspace (`client/`):** React 19 SPA bootstrapped with Vite 8. Styled using Tailwind CSS 4 with custom dark slate palettes and emerald/teal accents. Client-side routing via React Router with public, protected, and role-based route guards.
- **Server Workspace (`server/`):** Express 5 application running on Node.js 22 LTS with native ES modules. Enforces strict input validation with Zod, defensive HTTP security headers, centralized error handling, and structured JSON responses.
- **Database (`server/db/`):** PostgreSQL relational engine running under third normal form (3NF) and Boyce-Codd normal form (BCNF), utilizing declarative constraints, partial indexes, security-invoker views, stored procedures, and audit triggers.
- **Worker Daemon (`server/scripts/startReminderWorker.js`):** Independent polling daemon executing calendar-aware reminder evaluation at configurable intervals with concurrency protection.

---

## 3. Database Architecture & Relational Engineering (DBMS)

As a DBMS capstone, SpendWise AI emphasizes database rigor, relational integrity, and query efficiency over client-side computation.

### 3.1 Relational Schema & Normalization
The database schema consists of 12 application tables (and 1 migration metadata table), normalized to 3NF/BCNF:
1. `users`: Identity and credential storage with salted bcrypt hashes (configurable cost factor 12) and account status tracking.
2. `user_preferences`: One-to-one preferences profile configuring currency, renewal windows, timezone, and communication channels.
3. `auth_sessions`: Active refresh-token session store enabling cryptographically secure token rotation and instantaneous multi-device revocation.
4. `categories`: Normalized classification taxonomy for recurring services.
5. `services`: Verified catalog services with preconfigured category mappings and default metadata.
6. `subscriptions`: Core subscription entity enforcing mutual exclusivity between verified catalog services and custom provider entries.
7. `subscription_audit_events`: Append-only audit ledger recording historical term changes via PostgreSQL triggers.
8. `payments`: Immutable historical billing ledger tracking individual billing periods, payment statuses, and net amounts.
9. `refunds`: Granular refund ledger linked to payment records, enforcing non-negative balances.
10. `notifications`: In-app and scheduled alert ledger with user deduplication constraints.
11. `recommendations`: Cost-optimization engine output storing candidate rule matches, confidence scores, and historical resolution states.
12. `recommendation_subscriptions`: Join table associating specific subscriptions with generated cost-optimization recommendations.

### 3.2 Integrity Constraints & Declarative Rules
- **Foreign Key Constraints:** All foreign keys utilize explicit referential actions (`ON DELETE RESTRICT` or `ON DELETE CASCADE`) to prevent orphaned financial records.
- **Compound Keys:** `uq_recommendations_user_id_id (user_id, id)` and `uq_notifications_user_deduplication (user_id, deduplication_key)` prevent cross-tenant data leaks and redundant alerts.
- **Check Constraints:** Over 25 domain check constraints enforce data integrity at the storage level:
  - `chk_subscriptions_price`: `price >= 0`
  - `chk_subscriptions_currency`: `currency_code ~ '^[A-Z]{3}$'`
  - `chk_subscriptions_next_renewal`: Next renewal date must be on or after the start date.
  - `chk_refunds_amount`: Refund amount must be greater than zero.
  - `chk_recommendations_priority`: Priority must be `'high'`, `'medium'`, or `'low'`.

### 3.3 Advanced Database Objects (Stage 11 Implementation)
1. **Stored Functions:**
   - `spendwise_monthly_equivalent(p_amount NUMERIC, p_billing_cycle TEXT) -> NUMERIC`: Computes exact normalized monthly commitments (`monthly` P, `quarterly` P / 3, `yearly` P / 12) with sub-cent rounding and SQLSTATE 22023 cycle validation.
   - `spendwise_user_financial_summary(p_user_id BIGINT, p_start_date DATE, p_end_date DATE)`: Returns completed payment counts, gross payments, completed refunds, and net cash flow grouped by currency code without join fanout.
   - `spendwise_audit_subscription_changes()`: Trigger function comparing `OLD` and `NEW` records with `IS DISTINCT FROM` to capture modified subscription terms into JSONB.
2. **Stored Procedure:**
   - `spendwise_retire_stale_recommendations(IN p_user_id BIGINT, IN p_rule_version VARCHAR(40), IN p_active_keys VARCHAR(200)[], IN p_evaluated_at TIMESTAMPTZ, INOUT p_retired_count INTEGER)`: Atomically reconciles and marks inactive recommendations no longer supported by current subscription state within bounded execution limits.
3. **Audit Trigger (`trg_subscriptions_audit_terms`):**
   - Fires `AFTER UPDATE OF status, price, billing_cycle, next_renewal_date ON subscriptions FOR EACH ROW`.
   - Automatically records modified field names and pre/post values into `subscription_audit_events`.
4. **Security-Invoker Views:**
   - `active_subscription_commitments`: `WITH (security_invoker = true)` — Projects active and trial subscriptions with normalized monthly and yearly equivalent commitments.
   - `completed_payment_financials`: `WITH (security_invoker = true)` — Joins completed payments with pre-aggregated completed refunds and net cash flow.
5. **Partial Covering Index:**
   - `idx_payments_completed_subscription_covering`:
     ```sql
     CREATE INDEX idx_payments_completed_subscription_covering
       ON payments (subscription_id, payment_date DESC, currency_code)
       INCLUDE (id, amount)
       WHERE payment_status = 'completed';
     ```
   - Empirically verified on a 50,000-row dataset in `spendwise_test`, shifting execution from Index Scan to Index Only Scan, improving mean execution time by 21.6% (0.612 ms to 0.480 ms, median 0.603 ms to 0.461 ms), and reducing buffer hits from 15 to 6 blocks.

---

## 4. Security Hardening & Isolation Architecture

SpendWise AI implements multi-layered defensive security across the network, transport, application, and database tiers:

1. **Defensive Security Headers:**
   - `X-Content-Type-Options: nosniff` (prevents MIME type confusion attacks).
   - `X-Frame-Options: DENY` (prevents clickjacking attacks).
   - `Referrer-Policy: strict-origin-when-cross-origin` (prevents sensitive path leakage).
   - `X-XSS-Protection: 0` (disables buggy legacy browser filters in favor of modern sanitization).
   - `Cross-Origin-Opener-Policy: same-origin` (isolates browsing contexts).
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (enforced automatically in production).
   - Server fingerprint suppression (`app.disable('x-powered-by')`).
2. **Reverse Proxy Trust:**
   - Configurable `TRUST_PROXY` support (`loopback`, `1`, or custom IP) ensuring accurate IP extraction for rate limiting when deployed behind Cloudflare, Render, or Nginx.
3. **Session & Token Architecture:**
   - Short-lived JWT access tokens (15-minute lifetime).
   - Cryptographically random refresh tokens stored in `HttpOnly`, `SameSite=Lax`, and `Secure` (production) cookies.
   - Server-side database validation (`auth_sessions`) ensures that logging out or changing a password immediately invalidates active refresh tokens.
4. **CSRF & Origin Verification:**
   - State-modifying authentication routes require trusted browser origin verification (`Origin` or `Referer` matching `CORS_ORIGIN`) and custom XMLHttpRequest headers.
5. **Cross-Account Resource Isolation (404 Policy):**
   - The application strictly enforces multi-tenant boundary checks. When User B attempts to access User A's subscription, payment, refund, notification, or recommendation, the API responds with an ambiguous `404 NOT_FOUND` rather than a `403 FORBIDDEN`, preventing ID enumeration and resource existence disclosure.
6. **SQL Parameterization & Input Defense:**
   - Zero dynamic SQL string concatenation. All database queries pass through PostgreSQL parameterized placeholders (`$1, $2, ...`).
   - Boundary validation on numeric and date values (rejecting negative prices, zero payments, and inverted date ranges).
   - Maximum JSON payload limit of 100 KB (`HTTP 413 Payload Too Large`).
   - Spreadsheet formula injection neutralization in CSV exports (cells starting with `=`, `+`, `-`, or `@` are automatically prefixed with a single quote `'`).

---

## 5. Verification, Testing & QA Engineering

SpendWise AI enforces a comprehensive automated test pyramid spanning five distinct test paradigms:

| Test Suite | Framework / Tool | Test Count | Pass Rate | Scope & Objectives |
| :--- | :--- | :---: | :---: | :--- |
| **Server Unit & Route Tests** | Node.js Test Runner | 83 | 100% | Business logic, token managers, calendar rules, money math, API controllers, security validations |
| **Client Component Tests** | Vitest & React Testing Library | 50 | 100% | React components, hooks, auth providers, forms, layouts, responsive navigation |
| **Database & Security Integration** | Node.js Test Runner + `pg` | 62 | 100% | Real PostgreSQL 18.6 queries, migrations, constraint validations, stored routines, cross-tenant isolation |
| **Full-Stack User Journeys** | Deterministic Journey Runner | 21 | 100% | 21 sequential full-stack user journeys covering full lifecycle from healthcheck to report export |
| **Browser E2E Automation**| Playwright Test | 4 specs (10 scenarios) | Configured | Headless browser testing specs covering UI rendering, form submission, and route transitions |

### Test Execution Commands
- Database Integration Suite: `npm run test:db`
- Complete 21-Workflow Journey Verification: `npm run test:journeys`
- Full Workspace Test Suite: `npm test`
- Code Style & Linter: `npm run lint` && `npm run format:check`
- Production Build: `npm run build`

---

## 6. Deployment Readiness & Infrastructure as Code

SpendWise AI includes turnkey configuration files for containerized and cloud-native hosting:

- **Docker:** Production multi-stage `Dockerfile` creating a hardened, lightweight Node.js 22 Alpine runtime executing under the non-root `node` user with an automated container healthcheck.
- **Docker Compose:** `docker-compose.yml` orchestrating PostgreSQL 16 with persistent volumes, the Express backend API, and the background reminder worker with health dependency checks.
- **Render Cloud:** `render.yaml` declaring an infrastructure blueprint comprising a managed PostgreSQL database (`spendwise-db`), a Node web service (`spendwise-api`), and a static web service (`spendwise-web`).
- **Vercel / Static Hosting:** `vercel.json` and `client/public/_redirects` configuring single-page application (SPA) client rewrite rules (`/* -> /index.html 200`).
- **SSL / TLS:** Native database SSL connectivity (`DATABASE_SSL=true`) supporting secure managed PostgreSQL providers (Supabase, Neon, Render, AWS RDS).

---

## 7. Known Limitations & Roadmap

1. **Live Bank Synchronization:** SpendWise AI deliberately avoids fragile third-party screen-scraping banking APIs (such as Plaid or Yodlee) in favor of precise, user-controlled records. Direct Open Banking integrations can be added in future enterprise iterations.
2. **Third-Party Email / SMS Gateways:** Reminder delivery currently utilizes an internal in-app notification center and database worker. Integrating SendGrid, AWS SES, or Twilio requires only injecting delivery adapters into the existing reminder service.
3. **Currency Conversion Rates:** Multi-currency calculations currently isolate and report commitments per currency code to prevent exchange rate volatility from corrupting historical accounting. Live FX rate synchronization represents a logical future enhancement.

---

## 8. Conclusion

SpendWise AI demonstrates that modern web applications can achieve exceptional user experience without sacrificing software architecture or database rigor. By combining React 19, Express 5, and PostgreSQL 18.6 with declarative constraints, stored routines, comprehensive security defenses, and automated verification, SpendWise AI represents a portfolio-caliber, production-ready solution to subscription management and personal financial clarity.
