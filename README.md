# SpendWise AI

> Smart Subscription Manager: AI-Powered Subscription Tracking and Cost Optimization

SpendWise AI is a planned full-stack web application for managing recurring subscriptions in one place. It will help users record subscriptions and payments, monitor renewals, understand recurring spending, and receive explainable cost-optimization suggestions based on their own stored data.

The project is designed as a university Database Management Systems (DBMS) project and a portfolio application. Its implementation will emphasize relational data modeling, raw PostgreSQL queries, data integrity, meaningful reporting, and maintainable full-stack architecture.

## Current Status

**Stage 1 of 12 — Project Planning & Requirements**

This repository currently contains planning documentation only. Application features, APIs, database objects, and user interfaces have not yet been implemented.

## Planned Features

- JWT-based registration, login, protected routes, and per-user data isolation
- Subscription CRUD with categories, billing cycles, lifecycle statuses, and renewal dates
- Historical and expected payment tracking with distinct payment statuses
- Monthly and yearly cost estimates with documented billing-cycle normalization
- Dashboard analytics, category breakdowns, spending trends, and upcoming renewals
- Configurable in-app renewal and trial-expiration notifications
- Explainable, rule-based cost-optimization recommendations
- Optional LLM-generated explanations grounded in stored user data at a later stage
- DBMS demonstrations using constraints, joins, aggregates, views, indexes, transactions, triggers, stored functions, and query analysis

## Planned Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React.js, Vite, Tailwind CSS, React Router, Axios, Recharts |
| Backend | Node.js, Express.js, RESTful APIs, JWT, bcrypt |
| Database | PostgreSQL, raw SQL through `pg`, migrations, seed scripts |
| Analytics and AI | SQL analytics, deterministic rule-based recommendations, optional later LLM integration |
| Quality tooling | ESLint, Prettier, API testing, automated testing tools selected during implementation |

No ORM is planned because direct SQL and relational database concepts are central learning and demonstration goals.

## Development Roadmap

1. Project Planning & Requirements — **current stage**
2. System Architecture & Project Setup
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

See the [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md) for objectives, dependencies, deliverables, and acceptance criteria for every stage.

## Planning Documentation

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [Functional and Non-Functional Requirements](docs/REQUIREMENTS.md)
- [User Workflows](docs/USER_WORKFLOWS.md)
- [High-Level System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Preliminary Database Planning](docs/DATABASE_PLANNING.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)

## Important Boundaries

- The initial system uses manually entered subscription and payment data.
- It does not connect to banks, payment gateways, or subscription providers.
- It does not make payments or cancel subscriptions.
- Recommendations are advisory estimates, not guaranteed savings or claims about actual service usage.
- Cross-currency totals will not be combined without an explicit conversion source and policy; the MVP will present monetary analytics by currency.

## Repository Workflow

Development work is performed incrementally on the `develop` branch. Each stage is reviewed before changes are manually committed and pushed.
