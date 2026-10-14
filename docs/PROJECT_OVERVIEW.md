# Project Overview

## 1. Project Background

Paid digital services are increasingly spread across entertainment, productivity, cloud storage, education, and other categories. A person may subscribe to several services with different prices, billing cycles, renewal dates, and payment histories. Information distributed across receipts and individual provider accounts makes it difficult to understand the true recurring cost or notice an upcoming renewal.

SpendWise AI is a full-stack subscription management and cost-optimization application. It is also a university DBMS project intended to demonstrate practical relational modeling, integrity constraints, SQL reporting, transaction design, and query optimization in a maintainable application.

## 2. Problem Statement

Users lack a single, consistent view of their recurring subscriptions. As a result, they may have difficulty answering basic financial questions, including:

- What is the estimated monthly and yearly cost of active subscriptions?
- Which payments were actually made, and which are only expected?
- Which services renew soon or have trials about to expire?
- Which categories account for the most spending?
- Which subscriptions appear expensive or functionally overlapping?
- What savings might be possible if a user changes or cancels a service?

Provider-specific dashboards do not provide a consolidated view, and expected recurring charges are not the same as completed payments. Any useful solution must preserve that distinction and avoid unsupported claims about service usage or guaranteed savings.

## 3. Proposed Solution

SpendWise AI will provide a secure web application where authenticated users manually maintain subscription details and record payments. The system will normalize supported billing cycles for estimates, display analytics derived from stored records, surface upcoming renewals, and generate explainable optimization suggestions using deterministic rules.

The system will use a React frontend, an Express REST API, and PostgreSQL accessed with raw SQL through the `pg` library. An optional LLM integration may later improve the wording of recommendations, but calculations and facts will remain grounded in stored data and validated rules.

## 4. Project Objectives

1. Centralize subscription, renewal, and payment information for each user.
2. Keep user data isolated through authenticated, ownership-aware operations.
3. Distinguish projected recurring costs from historical completed payments.
4. Provide understandable monthly, annual, category, renewal, and trend analytics.
5. Notify users about upcoming renewals and trial expirations according to their preferences.
6. Produce explainable recommendations and clearly label potential savings as estimates.
7. Demonstrate relevant DBMS concepts through realistic application use cases.
8. Maintain an incremental architecture that supports later testing and deployment.

## 5. Intended Users

- Individuals who manage multiple recurring digital services
- Students and early-career professionals monitoring discretionary expenses
- Households or users who want a consolidated personal subscription record
- University evaluators reviewing the DBMS design and implementation
- Portfolio reviewers assessing full-stack and database engineering practices

The first release is a single-user-account experience: every account manages only its own records. Shared household accounts and administrative analytics are outside the MVP.

## 6. Main Benefits

- A centralized and searchable subscription inventory
- Clear separation between estimated future costs and confirmed payment history
- Visibility into upcoming renewals and trials
- Consistent monthly and yearly estimates across supported billing cycles
- Category and historical insights from real user-entered data
- Transparent recommendations that explain the triggering rule and estimated impact
- A database design that supports integrity, auditability, and efficient reporting

## 7. Assumptions and Limitations

### Assumptions

- Users enter and maintain accurate subscription and payment information.
- Supported initial billing cycles are monthly, quarterly, and yearly.
- A user subscription has one currency at a time, identified by an ISO 4217 currency code.
- Dates are stored consistently by the backend and displayed in the user's configured time zone.
- A renewal schedule is a projection; it does not prove that a payment occurred.
- Recommendation rules operate only on fields available to the system.
- Email delivery, external AI providers, and scheduled job infrastructure require later configuration if adopted.

### Limitations

- Manual data can be incomplete, outdated, or incorrect.
- The system cannot confirm actual usage unless a future explicit usage field or integration is introduced.
- Prices and subscription terms are not automatically synchronized with providers.
- The MVP does not perform foreign-exchange conversion. Analytics involving different currencies are separated by currency.
- Rule-based similarity or high-cost signals may require user judgment and can produce false positives.
- Reminder execution depends on the availability of a later background scheduler.

## 8. MVP Scope

The minimum viable product includes:

- User registration, login, logout, profile viewing/editing, and protected access
- Per-user authorization and ownership checks
- Subscription create, read, update, delete, search, filter, and status management
- Service and category association
- Monthly, quarterly, and yearly billing cycles
- Payment recording and payment-history viewing
- Explicit expected, completed, failed, and refunded payment states, subject to final Stage 3 design
- Monthly and yearly estimated costs by currency
- Active-subscription counts, category summaries, trends, expensive subscriptions, and upcoming renewals
- Configurable in-app reminders and a notification center
- Rule-based cost-optimization recommendations with reasons and potential-savings estimates
- Responsive, accessible core workflows and consistent error feedback

## 9. Advanced Features Planned for Later Stages

These features are beyond the MVP baseline but may be developed in the later roadmap stages if time and project constraints allow:

- Optional LLM-generated recommendation explanations constrained to validated data
- Additional billing intervals and proration rules
- Notification delivery through email or other channels
- Multiple user profiles or household sharing
- User-provided usage ratings or last-used dates to improve recommendation quality
- Currency conversion using an explicitly selected and timestamped rate source
- Import/export and more advanced reporting
- Progressive Web App capabilities
- Provider metadata enrichment through approved external data sources

Advanced features require separate acceptance criteria and must not weaken the reliability of the baseline rules.

## 10. Explicitly Out of Scope

- Bank-account aggregation or bank-transaction ingestion
- Payment gateway processing or financial transactions
- Automatic cancellation, upgrade, downgrade, or purchasing of subscriptions
- Credential storage for third-party subscription services
- Claims that the system knows whether a subscription is used without usage data
- Guaranteed savings, investment, tax, or regulated financial advice
- Native mobile applications in the initial roadmap
- Organization-wide billing administration or vendor procurement
- An ORM-based persistence layer unless a later documented requirement justifies it

## 11. Success Definition

SpendWise AI succeeds when a user can securely maintain an accurate subscription inventory, record payments, distinguish estimates from historical facts, inspect useful spending and renewal insights, and understand why each recommendation was produced. For the DBMS assessment, success also requires traceable and justified use of relational design, constraints, queries, transactions, reporting objects, and optimization techniques.
