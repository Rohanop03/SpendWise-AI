# SpendWise AI — User Guide & Application Manual

Welcome to **SpendWise AI — Smart Subscription Manager & Cost Optimization Engine**. This guide walk you through every feature of the application, from setting up your account to unlocking explainable financial insights and cost optimization.

---

## Table of Contents
1. [Getting Started & Account Creation](#1-getting-started--account-creation)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Managing Subscriptions](#3-managing-subscriptions)
4. [Tracking Payments & Refunds](#4-tracking-payments--refunds)
5. [Spending Analytics & Reports](#5-spending-analytics--reports)
6. [Notifications & Renewal Reminders](#6-notifications--renewal-reminders)
7. [AI-Powered Cost Optimization](#7-ai-powered-cost-optimization)
8. [Account Settings & Security](#8-account-settings--security)

---

## 1. Getting Started & Account Creation

### Registration
1. Navigate to the SpendWise AI landing page (`http://localhost:5173` or your production domain).
2. Click **Create account** or **Get started**.
3. Fill in your **Display Name**, **Email Address**, and choose a strong **Password** (minimum 8 characters).
4. Re-enter your password to confirm and click **Create account**.
5. Your account is created immediately with a private encrypted database record, and you will be directed to your dashboard.

### Signing In
1. Visit `/login` or click **Sign in** on the navigation bar.
2. Enter your registered email and password.
3. SpendWise AI issues a secure 15-minute access token and an encrypted HttpOnly refresh cookie that maintains your session safely across browser refreshes.

---

## 2. Dashboard Overview

The **Dashboard** serves as your mission control center:

```
+-----------------------------------------------------------------------------------+
|  SpendWise AI     [Subscriptions]  [Payments]  [Analytics]  [Insights]  [(2) User]  |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  Monthly Spend Commitment    Active Subscriptions     Upcoming Renewals (7 Days) |
|         $124.50                      8                            2               |
|                                                                                   |
|  +---------------------------------------+  +----------------------------------+  |
|  | Quick Action: Add Subscription        |  | AI Optimization Alert:           |  |
|  | [ + Add Subscription ]                |  | Potential overlap detected!      |  |
|  +---------------------------------------+  +----------------------------------+  |
|                                                                                   |
|  Recent Payment Activity                 Upcoming Renewal Schedule                |
|  - Netflix ($15.99) - Oct 01             - Cloud Pro ($9.99) - Oct 25 (Trial)    |
|  - Gym Membership ($85.00) - Oct 15      - Spotify ($10.99) - Nov 01             |
+-----------------------------------------------------------------------------------+
```

- **Top KPI Cards:** Live statistics showing your monthly financial commitment, total active subscriptions count, and count of renewals due within the next 7 days.
- **Renewal Alert Feed:** Highlights upcoming trial expirations and renewal events.
- **Top Categories Chart:** Visual breakdown of where your recurring budget is allocated.

---

## 3. Managing Subscriptions

### Adding a New Subscription
Click **Add Subscription** from the dashboard or the subscriptions list:

1. **Choose Provider Type:**
   - **Catalog Service:** Select from pre-configured verified services (e.g., Netflix, Spotify, AWS, GitHub). Categories and icons populate automatically.
   - **Custom Service:** Click "Enter custom service" to track private gym memberships, local utilities, niche software licenses, or personal commitments.
2. **Select Billing Cycle:** Choose `Monthly`, `Quarterly`, or `Yearly`. SpendWise AI automatically calculates equivalent monthly commitments for accurate budgeting.
3. **Set Price and Currency:** Enter the exact recurring price and select the currency (USD, EUR, GBP, INR, etc.).
4. **Dates and Status:**
   - **Status:** Choose `Active`, `Trial`, `Paused`, or `Cancelled`.
   - **Start Date:** The original inception date.
   - **Next Renewal Date:** When your next charge is scheduled.
   - **Trial End Date:** Required if status is set to `Trial` to ensure timely reminder alerts before you are charged.
5. Click **Save Subscription**.

### Searching, Filtering, and Sorting
On the **Subscriptions** page (`/subscriptions`):
- **Search Bar:** Real-time search across service names and plan descriptions.
- **Category Filter:** Filter by specific categories (Entertainment, Productivity, Utilities, etc.).
- **Status Filter:** Switch between Active, Trial, Paused, or Cancelled.
- **Sort Options:** Order by Price (High to Low / Low to High), Next Renewal Date, or Date Added.

### Archiving Subscriptions
When you stop using a service, do not delete it! Click **Archive Subscription**:
- Soft-archiving removes the subscription from active renewal alerts and monthly calculations.
- Historical payment and refund records remain completely preserved in your accounting ledger.
- You can view archived subscriptions anytime using the "Show Archived" toggle and restore them with one click.

---

## 4. Tracking Payments & Refunds

### Recording a Manual Payment
1. Navigate to **Billing & Payments** (`/payments`).
2. Click **Record Payment** or navigate to any subscription detail page and click **Record Payment**.
3. Enter:
   - **Amount & Currency:** Actual amount charged.
   - **Payment Date:** The date transaction occurred.
   - **Billing Period:** Start and End dates for this invoice cycle.
   - **Payment Status:** `Completed`, `Pending`, or `Failed`.
   - **Notes:** Optional receipt number or invoice identifier.
4. Click **Save Payment**.

### Processing Refunds
If a provider issues a full or courtesy refund:
1. Locate the completed payment in the payments list.
2. Click **Refund** or view the payment details.
3. Enter the refunded amount and an optional reason (e.g., "Outage credit" or "Service cancellation").
4. SpendWise AI validates that the refund cannot exceed the remaining payment balance, updates net cash outflow in real time, and logs the transaction in the immutable ledger.

---

## 5. Spending Analytics & Reports

Navigate to **Analytics** (`/analytics`) to inspect multi-dimensional financial reports:

- **Financial Overview:** Shows Gross Payments, Completed Refunds, Net Cash Flow, and Monthly Recurring Commitments isolated by active currency.
- **Spending Trends:** Dynamic bar charts illustrating your cash outflow trajectory across preceding months.
- **Category Breakdown:** Interactive pie/doughnut visualization showing the percentage share of each category in your overall budget.
- **Custom Report & CSV Export:**
  - Filter your analytics by date range or specific category.
  - Click **Export CSV** to download a spreadsheet-ready financial report. SpendWise AI automatically neutralizes formula injection risks for safe opening in Microsoft Excel or Google Sheets.

---

## 6. Notifications & Renewal Reminders

Click the **Bell Icon** on the navigation bar to access the Notification Center:

- **Unread Counter Badge:** Instantly shows how many renewal or trial notices require your attention.
- **Reminder Types:**
  - **Renewal Notice:** Sent based on your preference window (default: 7 days before charge).
  - **Trial Expiration:** Critical alert warning you before a trial converts to a paid subscription.
- **Actions:**
  - Click any notification to review details.
  - Click **Mark as read** on individual alerts or **Mark all as read** to clear the badge.

---

## 7. AI-Powered Cost Optimization

Navigate to **Recommendations** (`/recommendations`) to review cost-reduction insights:

1. **Click "Scan Opportunities":** SpendWise AI analyzes your subscription graph and historical payment records using deterministic rules.
2. **Opportunity Categories:**
   - **Exact Duplicates:** Detects duplicate subscriptions for the same service across different plans.
   - **Potential Overlaps:** Identifies redundant services within the same category (e.g., multiple streaming platforms).
   - **Price Outliers:** Flags subscriptions whose cost exceeds 3x the category median.
   - **Spending Concentration:** Highlights when a single category dominates more than 50% of your recurring budget.
   - **Trial Reviews:** Warns of imminent trial conversions.
3. **Hypothetical Monthly Savings:** Every opportunity displays estimated potential savings.
4. **Explainable AI:** Click **Explain** on any recommendation to read a natural-language breakdown of why this recommendation was triggered.
5. **Resolving or Dismissing:** Click **Dismiss** if you wish to keep both services, or update your subscription once cancelled to mark the opportunity **Resolved**.

---

## 8. Account Settings & Security

Visit **Settings** (`/settings`):
- **Preferred Currency:** Change your primary reporting currency (USD, EUR, GBP, INR, CAD, etc.).
- **Renewal Alert Lead Time:** Adjust renewal reminder warnings from 1 to 30 days ahead of the renewal date.
- **Notification Toggles:** Enable or disable in-app and renewal alerts.
- **Change Password:** Update your passphrase securely; all active sessions across other devices are automatically revoked.
- **Sign Out:** Securely terminates your session and wipes authentication cookies.
