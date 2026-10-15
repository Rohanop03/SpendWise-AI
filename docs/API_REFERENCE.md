# SpendWise AI — REST API Reference

**Base URL:** `http://localhost:5000/api/v1` (or production host)  
**Protocol:** HTTP/1.1 or HTTP/2 (HTTPS required in production)  
**Data Format:** `application/json` (with CSV export support on specific endpoints)  
**Authentication:** Bearer token via `Authorization: Bearer <accessToken>` header  
**Session Refresh:** `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`spendwise_refresh`)  

---

## 1. Global Conventions & Error Response Format

### Standard Error Response Schema
All error responses return consistent JSON structures matching the `AppError` architecture:

```json
{
  "status": "error",
  "message": "Human-readable description of the error",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation rule failure description"
    }
  ]
}
```

### Standard Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or domain constraint violation (`VALIDATION_ERROR`, `INVALID_CATEGORY`, etc.).
- `401 Unauthorized`: Missing, invalid, or expired credentials (`AUTHENTICATION_REQUIRED`, `INVALID_SESSION`).
- `404 Not Found`: Target resource does not exist or belongs to another user (`NOT_FOUND`).
- `413 Payload Too Large`: Request body exceeds 100 KB limit.
- `429 Too Many Requests`: Exceeded rate limit window (`RATE_LIMITED`).
- `500 Internal Server Error`: Unhandled server exception (sanitized in production).
- `503 Service Unavailable`: Database connectivity check failure.

---

## 2. System Health & Infrastructure

### `GET /health`
Returns system liveness and PostgreSQL database connectivity status.

- **Authentication:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-15T12:00:00.000Z",
    "services": {
      "database": "connected"
    }
  }
  ```
- **Response `503 Service Unavailable`:** Returned if PostgreSQL fails to respond.

---

## 3. Authentication & Account Management (`/auth`)

### `POST /auth/register`
Creates a new user account with hashed password storage.

- **Authentication:** None (requires trusted Origin/XMLHttpRequest)
- **Request Body:**
  ```json
  {
    "displayName": "Jane Doe",
    "email": "jane@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response `201 Created`:**
  - Returns `{ "accessToken": "eyJhbGci...", "user": { "id": "1", "displayName": "Jane Doe", "email": "jane@example.com" } }`
  - Sets `Set-Cookie: spendwise_refresh=...; HttpOnly; SameSite=Lax; Path=/api/v1/auth`

### `POST /auth/login`
Authenticates user credentials and issues session tokens.

- **Authentication:** None (requires trusted Origin/XMLHttpRequest)
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response `200 OK`:** Returns new `accessToken`, user object, and sets refresh cookie.

### `POST /auth/refresh`
Rotates the refresh token and issues a fresh 15-minute access token.

- **Authentication:** Refresh token cookie required
- **Response `200 OK`:** Returns fresh `accessToken`, user object, and updated refresh cookie.
- **Response `401 Unauthorized`:** If session is expired, revoked, or invalid.

### `POST /auth/logout`
Revokes the server-side database session and clears the refresh cookie.

- **Authentication:** Refresh token cookie
- **Response `200 OK`:** `{ "message": "Logged out." }`

### `GET /auth/me`
Retrieves currently authenticated user identity and session validity.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "user": { "id": "1", "displayName": "Jane Doe", "email": "jane@example.com" } }`

### `POST /auth/change-password`
Updates user password and revokes all other active sessions.

- **Authentication:** Bearer token
- **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongerPassword456!"
  }
  ```
- **Response `200 OK`:** `{ "message": "Password changed successfully." }`

---

## 4. User Preferences (`/users`)

### `GET /users/me/preferences`
Retrieves user preferences profile.

- **Authentication:** Bearer token
- **Response `200 OK`:**
  ```json
  {
    "preferences": {
      "notificationsEnabled": true,
      "preferredCurrency": "USD",
      "renewalReminderDays": 7,
      "renewalRemindersEnabled": true,
      "timezone": "America/New_York",
      "trialReminderDays": 3,
      "trialRemindersEnabled": true
    }
  }
  ```

### `PATCH /users/me/preferences`
Updates user preferences.

- **Authentication:** Bearer token
- **Request Body:** Any subset of preference fields.
- **Response `200 OK`:** Returns updated preferences object.

---

## 5. Catalog Discovery (`/categories`, `/services`)

### `GET /categories`
Lists all normalized service categories.

- **Authentication:** None
- **Response `200 OK`:** `{ "categories": [ { "id": "1", "name": "Streaming & Entertainment" } ] }`

### `GET /services`
Lists verified catalog services with metadata and default category mappings.

- **Authentication:** None
- **Response `200 OK`:** `{ "services": [ { "id": "1", "name": "Netflix", "defaultCategoryId": "1", "websiteUrl": "https://netflix.com" } ] }`

---

## 6. Subscriptions Management (`/subscriptions`)

### `GET /subscriptions`
Lists subscriptions for the authenticated user with filtering, pagination, and sorting.

- **Authentication:** Bearer token
- **Query Parameters:**
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 10, max: 100)
  - `status`: `'active' | 'trial' | 'paused' | 'cancelled'`
  - `categoryId`: String / ID
  - `billingCycle`: `'monthly' | 'quarterly' | 'yearly'`
  - `search`: String (searches service name and plan name)
  - `sortBy`: `'price' | 'nextRenewalDate' | 'createdAt' | 'name'`
  - `sortOrder`: `'asc' | 'desc'`
  - `archived`: `'true' | 'false'` (default: `'false'`)
- **Response `200 OK`:**
  ```json
  {
    "items": [
      {
        "id": "1",
        "serviceName": "Spotify",
        "categoryName": "Music & Audio",
        "price": 10.99,
        "currencyCode": "USD",
        "billingCycle": "monthly",
        "status": "active",
        "startDate": "2026-01-01",
        "nextRenewalDate": "2026-11-01",
        "planName": "Individual Plan"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 1,
      "totalPages": 1
    }
  }
  ```

### `POST /subscriptions`
Creates a new subscription entry (either catalog service or custom provider).

- **Authentication:** Bearer token
- **Request Body:**
  ```json
  {
    "serviceId": "1",
    "categoryId": "1",
    "price": 15.99,
    "currencyCode": "USD",
    "billingCycle": "monthly",
    "startDate": "2026-10-01",
    "nextRenewalDate": "2026-11-01",
    "status": "active",
    "planName": "Standard HD"
  }
  ```
- **Response `201 Created`:** `{ "subscription": { ... } }`

### `GET /subscriptions/:id`
Retrieves details for a specific subscription.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "subscription": { ... } }`
- **Response `404 Not Found`:** Returned if subscription does not exist or belongs to another user.

### `PATCH /subscriptions/:id`
Updates subscription terms (price, plan, renewal date, notes).

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "subscription": { ... } }`

### `POST /subscriptions/:id/archive` & `POST /subscriptions/:id/restore`
Soft-archives or restores an existing subscription without deleting historical payment records.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "subscription": { ... } }`

---

## 7. Payments & Refunds (`/payments`, `/subscriptions/:id/payments`)

### `POST /subscriptions/:subscriptionId/payments`
Records a completed, pending, or failed payment against a subscription.

- **Authentication:** Bearer token
- **Request Body:**
  ```json
  {
    "amount": 15.99,
    "currencyCode": "USD",
    "paymentDate": "2026-10-01",
    "paymentStatus": "completed",
    "billingPeriodStart": "2026-10-01",
    "billingPeriodEnd": "2026-10-31",
    "notes": "Invoice #5521"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "payment": {
      "id": "1",
      "subscriptionId": "1",
      "amount": "15.99",
      "currencyCode": "USD",
      "paymentDate": "2026-10-01",
      "paymentStatus": "completed",
      "totalRefunded": "0.00",
      "netAmount": "15.99",
      "remainingRefundable": "15.99"
    }
  }
  ```

### `GET /payments`
Lists payment records with filtering and pagination.

- **Authentication:** Bearer token
- **Query Parameters:** `page`, `limit`, `subscriptionId`, `paymentStatus`, `startDate`, `endDate`, `currencyCode`.
- **Response `200 OK`:** `{ "items": [...], "pagination": { ... } }`

### `POST /payments/:id/refunds`
Records a full or partial refund against a completed payment.

- **Authentication:** Bearer token
- **Request Body:**
  ```json
  {
    "amount": 5.00,
    "reason": "Courtesy discount",
    "refundDate": "2026-10-05"
  }
  ```
- **Response `201 Created`:** `{ "refund": { ... } }`
- **Response `400 Bad Request`:** If refund amount exceeds remaining refundable balance.

---

## 8. Spending Analytics & SQL Reports (`/analytics`)

### `GET /analytics/overview`
Calculates total gross payments, refunds, net cash flow, and monthly recurring commitment per active currency.

- **Authentication:** Bearer token
- **Query Parameters:** `startDate`, `endDate`, `currencyCode`.
- **Response `200 OK`:**
  ```json
  {
    "currencySummaries": [
      {
        "currencyCode": "USD",
        "grossPayments": "120.98",
        "completedRefunds": "5.00",
        "netCashFlow": "115.98",
        "completedPaymentCount": 3,
        "estimatedMonthlyRecurring": "45.98"
      }
    ],
    "period": { "startDate": null, "endDate": null }
  }
  ```

### `GET /analytics/trends`
Projects periodic cash outflow trends grouped by month or billing cycle.

- **Authentication:** Bearer token
- **Query Parameters:** `currencyCode`, `interval` (`'monthly' | 'yearly'`), `startDate`, `endDate`.
- **Response `200 OK`:** `{ "trends": [ ... ] }`

### `GET /analytics/categories`
Calculates spending distribution and percentage breakdown across categories.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "categories": [ { "categoryName": "Streaming", "grossPayments": "45.98", "percentageOfGross": 38.0 } ] }`

### `GET /analytics/report/export`
Exports a comprehensive financial statement in CSV format with spreadsheet formula injection protection.

- **Authentication:** Bearer token
- **Response `200 OK`:** CSV text attachment (`Content-Type: text/csv`).

---

## 9. Notification Center (`/notifications`)

### `GET /notifications`
Lists in-app notifications and scheduled alerts.

- **Authentication:** Bearer token
- **Query Parameters:** `page`, `limit`, `isRead` (`'true' | 'false'`).
- **Response `200 OK`:** `{ "notifications": [ ... ], "pagination": { ... } }`

### `GET /notifications/unread-count`
Returns the total count of unread notifications for navbar badges.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "count": 2 }`

### `PATCH /notifications/:id/read`
Marks an individual notification as read.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "notification": { "id": "1", "isRead": true, "readAt": "..." } }`

### `PATCH /notifications/read-all`
Marks all notifications for the authenticated user as read.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "updatedCount": 5 }`

---

## 10. AI-Powered Cost Optimization (`/recommendations`)

### `POST /recommendations/generate`
Executes the deterministic recommendation engine against user subscription records and persists opportunities.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "generatedCount": 2, "ruleVersion": "v1", "summary": { ... } }`

### `GET /recommendations`
Lists active or historical cost-optimization recommendations.

- **Authentication:** Bearer token
- **Query Parameters:** `status` (`'active' | 'dismissed' | 'resolved'`), `sortBy`, `sortOrder`.
- **Response `200 OK`:** `{ "recommendations": [ ... ], "pagination": { ... } }`

### `PATCH /recommendations/:id`
Updates recommendation status (e.g. dismissing or resolving an opportunity).

- **Authentication:** Bearer token
- **Request Body:** `{ "status": "dismissed" }`
- **Response `200 OK`:** `{ "recommendation": { ... } }`

### `POST /recommendations/:id/explain`
Generates natural language context for a specific recommendation using the grounded explanation adapter.

- **Authentication:** Bearer token
- **Response `200 OK`:** `{ "explanation": "You have two streaming subscriptions that share overlapping content libraries..." }`
