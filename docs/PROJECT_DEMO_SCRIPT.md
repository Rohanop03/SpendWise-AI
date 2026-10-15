# SpendWise AI — Live Project Demonstration & Presentation Script

**Project:** SpendWise AI — Smart Subscription Manager & Cost Optimization Engine  
**Presentation Duration:** 8 to 12 Minutes  
**Target Audience:** University Evaluators, Technical Interviewers, Engineering Peers  
**Presenter:** Rohan Patil  

---

## Presentation Checklist & Environment Prep

Before beginning the demo:
1. Open terminal in project root.
2. Ensure PostgreSQL is running (`spendwise_dev` seeded with demo records via `npm run db:seed:demo`).
3. Start full-stack development environment: `npm run dev`.
4. Open browser to `http://localhost:5173`.
5. Open second browser window (incognito) or database GUI (DBeaver / pgAdmin / psql) connected to `spendwise_dev`.

---

## 1. Introduction & The Problem (0:00 – 1:30)

### Talking Points
> "Good morning/afternoon. Today I am presenting **SpendWise AI — Smart Subscription Manager**, a university DBMS project and full-stack financial platform.
>
> The average household now manages between 10 and 20 recurring subscriptions across streaming, productivity, software, and fitness. This creates what economists call 'subscription fatigue'—forgotten free trials that roll over into annual fees, silent price hikes, and overlapping services.
>
> Most consumer solutions rely on fragile third-party aggregators or black-box LLMs that make up numbers. SpendWise AI was built on a different philosophy: **every calculation, refund, and recurring commitment is anchored in strict PostgreSQL relational algebra and ACID transactions**, while AI provides explainable, deterministic advice."

### Presenter Actions
- Show the **SpendWise AI Landing Page** (`http://localhost:5173`).
- Highlight the professional SaaS messaging, dark aesthetic, and core feature pillars.

---

## 2. Architecture & Technology Stack (1:30 – 3:00)

### Talking Points
> "Architecturally, SpendWise AI is structured as a hardened monorepo using npm workspaces:
> - On the frontend: **React 19**, **Vite 8**, and **Tailwind CSS 4**, delivering a responsive, keyboard-accessible SPA.
> - On the backend: **Node.js 22 LTS** and **Express 5**, using native ES modules, strict Zod schema validation, and multi-layered defensive security headers.
> - At the data layer: **PostgreSQL 18.6**, fully normalized to 3NF/BCNF, featuring declarative check constraints, partial covering indexes, security-invoker views, audit triggers, and stored procedures.
> - An independent background worker handles calendar-accurate renewal reminders without bogging down the HTTP request lifecycle."

### Presenter Actions
- Briefly show the high-level architecture diagram or open the project repo structure in VS Code.

---

## 3. Walkthrough 1: Secure Authentication & Subscription Management (3:00 – 4:45)

### Talking Points
> "Let's log in to the application. Authentication uses short-lived 15-minute JWT access tokens paired with encrypted, HttpOnly refresh cookies. All refresh sessions are validated against a database session table, meaning sessions can be revoked immediately upon logout or password change.
>
> On the dashboard, we immediately see our total monthly recurring commitment, active subscription count, and upcoming renewals due in the next 7 days.
>
> Let's add a subscription. We can choose from verified catalog services like Netflix or Spotify—which auto-populate category mappings—or enter a custom service like a local gym membership. The system validates billing cycles, enforces positive pricing, and calculates exact monthly equivalents."

### Presenter Actions
1. Log in with demo credentials (`demo@spendwise.local` / `DemoUser123!`).
2. Point out dashboard metric cards and renewal warnings.
3. Click **Add Subscription**; create a subscription for a custom service (e.g. "Equinox Gym", $85.00/mo, Next Renewal: 14 days out).
4. Show the new subscription appearing in the filtered list.

---

## 4. Walkthrough 2: Payments, Ledger Integrity & Partial Refunds (4:45 – 6:30)

### Talking Points
> "A core differentiator in SpendWise AI is its immutable payment ledger. Rather than assuming every active subscription charges money on a clean calendar day, SpendWise AI tracks actual payment events and billing periods.
>
> If a provider changes their price today, existing historical payment records remain unchanged. Furthermore, we support granular refund tracking. When a refund is recorded, the database calculates net cash flow and remaining refundable balances in real time."

### Presenter Actions
1. Navigate to **Billing & Payments** (`/payments`).
2. Select a subscription and record a manual completed payment of $85.00 for the current billing period.
3. Process a partial courtesy refund of $15.00 on that payment.
4. Point out how the payment card updates to show:
   - Gross Amount: $85.00
   - Total Refunded: $15.00
   - Net Cash Outflow: $70.00
   - Remaining Refundable: $70.00

---

## 5. Walkthrough 3: Spending Analytics & Spreadsheet Export (6:30 – 8:00)

### Talking Points
> "Under **Analytics**, SpendWise AI computes multi-dimensional financial reports powered by SQL aggregations.
>
> We see our Financial Overview broken down by currency to prevent foreign exchange distortion. We can inspect spending trends across past months, review category distribution percentages, and export a complete financial statement to CSV.
>
> Notice that for security, all exported CSV files automatically neutralize spreadsheet formula injection attacks by prepending single quotes to any cell beginning with an executable character like `=`, `+`, or `-`."

### Presenter Actions
1. Navigate to **Analytics** (`/analytics`).
2. Show the multi-currency financial overview cards.
3. Scroll down to show spending trend bar charts and category breakdown.
4. Click **Export CSV**; show downloaded file contents in text editor to demonstrate the formula protection.

---

## 6. Walkthrough 4: AI-Powered Cost Optimization (8:00 – 9:30)

### Talking Points
> "Now let's examine our AI-powered cost optimization engine. When we click **Scan Opportunities**, the backend evaluates deterministic rules across the user's subscription graph:
> - Detecting exact duplicates.
> - Flagging potential overlaps in the same category.
> - Identifying price outliers that exceed 3x the category median.
> - Warning of imminent trial conversions.
>
> Every opportunity shows an estimated monthly savings figure. Clicking **Explain** invokes our grounded explanation adapter, providing plain-English rationale without allowing an LLM to fabricate financial numbers."

### Presenter Actions
1. Navigate to **Recommendations** (`/recommendations`).
2. Click **Scan Opportunities** to generate recommendations.
3. Click on a recommendation (e.g., "Potential Streaming Overlap").
4. Click **Explain** to show natural language explanation.
5. Dismiss or resolve an opportunity and demonstrate how the procedural cleanup archives it.

---

## 7. Behind the Scenes: Advanced PostgreSQL & DBMS Highlights (9:30 – 11:00)

### Talking Points
> "To conclude the technical tour, let's look at the database engineering in PostgreSQL:
> 1. **Trigger Audit Trail:** Any update to subscription pricing or billing terms automatically fires an `AFTER UPDATE` trigger that records snapshots into `subscription_audit_events`.
> 2. **Stored Routines:** Functions like `spendwise_monthly_equivalent` and the bounded procedure `spendwise_retire_stale_recommendations` ensure critical business logic lives close to the data.
> 3. **Performance Optimization:** In Stage 11, we implemented a covering partial index on payments (`idx_payments_completed_subscription_covering`). In our empirical 50,000-row benchmark, this converted an index scan visiting heap data into an index-only scan, improving mean execution time by 21.6% (0.612 ms to 0.480 ms) and reducing buffer hit blocks from 15 to 6."

### Presenter Actions (Optional SQL Demonstration in psql or GUI)
Run in terminal or database client:
```sql
-- Show audit trigger events captured during the demo
SELECT change_type, old_values->>'price' AS old_price, new_values->>'price' AS new_price, changed_at
FROM subscription_audit_events
ORDER BY id DESC LIMIT 3;

-- Show security-invoker view
SELECT * FROM active_subscription_commitments LIMIT 3;
```

---

## 8. Conclusion & QA (11:00 – 12:00)

### Talking Points
> "To summarize: SpendWise AI combines the agility of a modern React 19 and Express 5 web application with the rock-solid data integrity, security, and performance of PostgreSQL 18.6.
>
> Across 12 engineering stages, we have implemented 216 automated tests with 100% pass rates, zero npm vulnerabilities, complete Docker and CI/CD pipelines, and comprehensive documentation.
>
> Thank you, and I am now ready to answer any questions or demonstrate specific code components."
