# Development Roadmap

## 1. Roadmap Principles

- Each stage builds on reviewed deliverables from prior stages.
- Planned features are not considered implemented until their stage acceptance criteria are verified.
- Database decisions remain visible and testable because DBMS concepts are core project outcomes.
- Security, accessibility, error handling, and user isolation are cross-cutting requirements rather than final-stage additions.
- Scope changes should update the relevant planning document before implementation proceeds.

## 2. Stage Summary

| Stage | Name | Primary outcome |
| ---: | --- | --- |
| 1 | Project Planning & Requirements | Agreed scope, requirements, workflows, conceptual data/architecture plan, and roadmap |
| 2 | System Architecture & Project Setup | Reproducible frontend/backend workspace and development standards |
| 3 | Database Design & PostgreSQL Setup | Normalized schema, migrations, constraints, and initial database access |
| 4 | Authentication & Account Management | Secure account workflows and enforced user isolation |
| 5 | Subscription Management | Validated subscription CRUD, search, filtering, and lifecycle states |
| 6 | Payment Tracking & Billing Management | Explicit payment history and reliable recurring-cost calculations |
| 7 | Spending Analytics & SQL Reporting | SQL-driven estimates, historical reports, views, and reporting APIs |
| 8 | Frontend Dashboard & Integration | Integrated responsive dashboard and core user experience |
| 9 | Renewal Reminders & Notifications | Preference-aware, retry-safe reminder processing and notification UI |
| 10 | AI-Powered Cost Optimization | Explainable rule-based recommendations and optional grounded explanations |
| 11 | Advanced DBMS Implementation | Justified advanced database objects, transactions, and measured optimization |
| 12 | Testing, Deployment & Documentation | Verified, deployable project with complete technical and user documentation |

## 3. Detailed Stages

### Stage 1 — Project Planning & Requirements

**Objective:** establish a consistent, testable definition of the problem, solution, product boundaries, data concepts, architecture, and delivery sequence.

**Major deliverables:**

- Project overview with MVP, advanced, and out-of-scope boundaries
- Numbered functional requirements and measurable non-functional requirements
- User workflow descriptions and Mermaid workflow diagram
- Preliminary entities, relationships, and DBMS use cases
- Conceptual system architecture and Mermaid architecture diagram
- Twelve-stage roadmap and current-status README

**Dependencies:** initial project idea, required stack, DBMS evaluation goals, and repository access.

**Acceptance criteria:**

- Scope, objectives, users, assumptions, and limitations are explicit.
- Requirements cover all requested feature groups and include verification criteria.
- Workflows, data planning, and architecture use consistent terminology.
- No application code, SQL schema, dependency installation, or fabricated data is introduced.

### Stage 2 — System Architecture & Project Setup

**Objective:** create a reproducible development foundation for the React frontend and Express backend without prematurely implementing product features.

**Major deliverables:**

- Frontend and backend scaffolding with documented directory boundaries
- Vite, React, Tailwind CSS, Express, and environment-configuration setup
- Shared development commands and environment examples without secrets
- ESLint and Prettier configuration
- Health-check API and minimal frontend connectivity proof
- Initial testing strategy, API conventions, error contract, and architecture decision records

**Dependencies:** approved Stage 1 scope, architecture, and terminology.

**Acceptance criteria:**

- A new developer can install dependencies and run both applications from documented commands.
- Linting/formatting and baseline tests execute successfully.
- The frontend can reach a non-sensitive backend health endpoint.
- No business feature is falsely represented as complete.

### Stage 3 — Database Design & PostgreSQL Setup

**Objective:** translate the conceptual model into a normalized, reproducible PostgreSQL design with enforceable integrity.

**Major deliverables:**

- ER diagram and data dictionary
- Functional-dependency and 1NF/2NF/3NF analysis
- Decisions for category ownership, deletion/history, payment states, and date/time semantics
- Ordered up/down or otherwise reversible migration strategy
- Tables, keys, constraints, and essential initial indexes
- Database connection/pool module using `pg` and parameterized-query conventions
- Development seed strategy, if needed, clearly separated from production

**Dependencies:** Stage 2 backend structure and Stage 1 database questions.

**Acceptance criteria:**

- A clean PostgreSQL database can be created reproducibly from migrations.
- Valid data succeeds and representative invalid/orphaned data is rejected.
- The schema is demonstrably in 3NF where appropriate, with exceptions justified.
- No ORM is introduced.

### Stage 4 — Authentication & Account Management — **complete**

**Objective:** implement safe account access, JWT authentication, profile operations, and server-enforced user isolation.

**Major deliverables:**

- Registration, login, logout, profile, and preferences APIs/UI
- bcrypt password hashing with constant-time dummy hash verification
- JWT verification and protected-route middleware
- Rotating PostgreSQL-backed refresh sessions in `auth_sessions` with SHA-256 digests and replay detection
- Default preference creation upon registration
- Transparent client-side Axios refresh interceptor for protected route recovery
- Authorization tests covering cross-user access attempts, CSRF defenses, and credential rate limits

**Dependencies:** Stages 2 and 3, environment secrets, finalized user/preference schema.

**Acceptance criteria:**

- Valid registration/login works; duplicates and invalid credentials fail safely. (Verified)
- Passwords are never stored or returned in plaintext; bcrypt hashing with cost factor 12 is verified. (Verified)
- Expired/invalid credentials and revoked sessions are rejected immediately. (Verified)
- One user cannot access another user's protected resources in automated tests. (Verified)


### Stage 5 — Subscription Management (Completed)

**Status:** Completed in Stage 5 (see [SUBSCRIPTION_MANAGEMENT.md](SUBSCRIPTION_MANAGEMENT.md))

**Objective:** implement owned subscription CRUD and discovery workflows using validated relational data.

**Major deliverables:**

- Reference service and category retrieval endpoints (`/api/v1/categories`, `/api/v1/services`)
- Full subscription CRUD, detail, partial updates, and soft archival/restoration APIs under `/api/v1/subscriptions`
- Frontend responsive dashboard, desktop table, mobile cards, search, multi-field filters, and archival confirmation modal
- Support for active, paused, trial, and cancelled states with synchronized `cancelled_at` timestamps
- Monthly, quarterly, and yearly cycle validation with normalized monthly cost calculations
- Multi-tenant user isolation, input validation, and database constraint enforcement verified via 35 server tests and 20 frontend Vitest tests

**Dependencies:** authenticated users, finalized service/category/subscription schema.

**Acceptance criteria:**

- All CRUD paths operate only on the authenticated user's records. (Verified)
- Search and combined filters return correct stable results. (Verified)
- Invalid prices, currencies, cycles, statuses, and dates fail without partial writes. (Verified)
- The selected history-preservation policy is consistently enforced. (Verified)

### Stage 6 — Payment Tracking & Billing Management

**Objective:** maintain accurate billing history and forward schedules without confusing expected and completed charges.

**Major deliverables:**

- Payment create, list, and permitted-correction APIs/UI
- Final payment-status semantics and realized-spending policy
- Upcoming expected-payment projection
- Central monthly/yearly normalization utility using fixed precision
- Transactional payment/schedule operation where justified
- Tests for price changes, refunds/statuses, rollbacks, and currency separation

**Dependencies:** Stage 5 subscriptions and Stage 3 payment/history decisions.

**Acceptance criteria:**

- Upcoming renewals do not automatically become completed payments.
- Historical payment totals use recorded amounts and remain unchanged after price edits.
- Normalization produces correct monthly/yearly estimates for all supported cycles.
- Transaction failures leave no partial payment/schedule state.

### Stage 7 — Spending Analytics & SQL Reporting

**Objective:** provide reliable SQL-backed financial insights while visibly separating estimates from historical facts.

**Major deliverables:**

- Active count, recurring estimates, category summaries, trends, upcoming renewals, and expensive-subscription reports
- Reporting APIs with date/status/currency policies
- Meaningful joins, aggregates, `GROUP BY`, `HAVING`, subqueries/CTEs, and initial views
- Query correctness tests including empty and multi-currency accounts
- Initial query plans captured for later optimization comparison

**Dependencies:** verified subscriptions, payments, normalization rules, and user isolation.

**Acceptance criteria:**

- Reports match hand-calculated fixtures for each supported billing cycle and payment status.
- Estimated and historical values are clearly labeled and never silently combined.
- Every report is scoped to the authenticated user and grouped by currency.
- SQL features are documented through real report use cases.

### Stage 8 — Frontend Dashboard & Integration

**Objective:** deliver a cohesive, responsive, and accessible interface for implemented account, subscription, payment, and analytics capabilities.

**Major deliverables:**

- Integrated dashboard and navigation
- Recharts visualizations with accessible summaries/alternatives
- Responsive subscription, payment, and analytics pages
- Central API client and authenticated error handling
- Loading, empty, validation, success, and failure states
- Frontend component/integration tests and accessibility checks

**Dependencies:** stable APIs from Stages 4–7 and agreed API/error contracts.

**Acceptance criteria:**

- Core workflows function across representative mobile, tablet, and desktop widths.
- Keyboard and focus behavior, labels, contrast, and error feedback pass the documented checks.
- Charts agree with textual/tabular values returned by the API.
- Session expiry and network failures have recoverable user experiences.

### Stage 9 — Renewal Reminders & Notifications

**Objective:** notify users of upcoming renewals and trial expirations according to per-user preferences.

**Major deliverables:**

- Reminder preference APIs/UI
- Scheduler/worker implementation and deployment strategy
- Due-renewal and trial-expiration detection
- Deduplicated notification creation
- Notification center, unread state, and mark-as-read operation
- Retry, time-zone, boundary-date, and idempotency tests

**Dependencies:** subscription dates/statuses, preferences, authentication, and deployment scheduling capability.

**Acceptance criteria:**

- Qualifying occurrences create exactly one notification for the configured lead window.
- Disabled or non-qualifying reminders create none.
- Repeated job execution is safe and does not duplicate logical notifications.
- Notifications remain separate from completed payments.

### Stage 10 — AI-Powered Cost Optimization

**Objective:** generate transparent cost-optimization suggestions from actual stored subscription data.

**Major deliverables:**

- Versioned rules for overlap, price outliers, and category concentration
- Evidence and estimated-savings formulas
- Recommendation persistence, API, UI, and dismissal/resolution flow
- False-positive safeguards, minimum-data rules, and currency comparison boundaries
- Optional LLM explanation adapter with privacy controls, strict grounding, timeout, and fallback
- Deterministic rule and grounding tests

**Dependencies:** trusted analytics, categories/services, payment/subscription data, and finalized thresholds.

**Acceptance criteria:**

- Every recommendation identifies its triggering rule and real supporting facts.
- Potential savings are labeled estimates and no recommendation claims unobserved usage.
- Same inputs and rule version yield equivalent recommendation facts.
- Optional provider failure returns the deterministic explanation without data corruption.

### Stage 11 — Advanced DBMS Implementation

**Objective:** complete and demonstrate justified advanced database capabilities and measured query optimization.

**Major deliverables:**

- Refined reporting views
- Justified stored function/procedure use cases
- Narrowly scoped triggers for audit/integrity behavior where appropriate
- Transaction/isolation demonstrations and concurrency tests
- Representative data-volume strategy
- `EXPLAIN ANALYZE` reports before and after index/query changes
- Index inventory with read/write tradeoffs

**Dependencies:** stable real queries and workflows from Stages 4–10.

**Acceptance criteria:**

- Every advanced database object maps to a real requirement and has correctness tests.
- Transaction demonstrations prove rollback and consistency behavior.
- Query optimization claims include repeatable plans/measurements on documented data and environment.
- Redundant or ineffective indexes and artificial database features are not retained.

### Stage 12 — Testing, Deployment & Documentation

**Objective:** verify the integrated system, deploy it safely, and provide reproducible project and DBMS documentation.

**Major deliverables:**

- Unit, integration, API, database, frontend, and end-to-end test coverage for critical paths
- Security, privacy, accessibility, performance-baseline, and responsive checks
- CI quality gates
- Production/development environment documentation and secret management
- Deployment, migration, rollback, backup, and recovery procedures
- Postman or equivalent API collection
- User guide, architecture/schema documentation, DBMS demonstration script, and known limitations

**Dependencies:** completion and stabilization of Stages 2–11 and access to selected deployment infrastructure.

**Acceptance criteria:**

- Critical end-to-end workflows pass in the deployment environment.
- Migrations and rollback/recovery procedures are rehearsed and documented.
- No secrets or demo credentials are committed.
- Known risks, measured performance, supported environments, and non-production limitations are stated honestly.
- A reviewer can reproduce the project and follow the DBMS demonstration from the documentation.

## 4. Cross-Stage Decision Log

The following decisions must be resolved and documented in their owning stages:

| Decision | Target stage |
| --- | ---: |
| Repository layout, API versioning, testing tools, and response/error conventions | 2 |
| Physical schema, deletion/history policy, category ownership, expected-payment model, date/time types | 3 |
| JWT storage, refresh, expiry, and revocation strategy | 4 |
| Subscription archival and price-history behavior | 5–6 |
| Realized-spending statuses and refund treatment | 6–7 |
| Scheduler technology, cadence, locking, and deployment | 9 |
| Recommendation thresholds, rule versioning, and optional LLM provider | 10 |
| Advanced database object selection and index optimization | 11 |
| Hosting, backups, retention, account deletion, supported browsers, and measured service targets | 12 |

## 5. Stage-Gate Practice

At the end of each stage:

1. Run the stage-specific checks.
2. Review Git status and the diff for unrelated changes or secrets.
3. Update documentation and current-status labels.
4. Record unresolved risks and decisions for the next stage.
5. Commit and push only after manual verification by the repository owner.
