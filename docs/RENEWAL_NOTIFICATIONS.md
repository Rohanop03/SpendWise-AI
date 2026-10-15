# Renewal Reminders and Notifications

## Overview

Stage 9 adds database-backed in-app renewal and trial-expiration reminders. Reminder generation runs in a dedicated Node.js process, not in a browser request or dashboard load. It never charges a user, creates a payment, advances a renewal date, changes subscription status, or contacts an external provider.

## Data model and idempotency

The existing `notifications` table remains the system of record. Migration `003_notification_target_dates.sql` adds `target_event_date DATE`, backfills existing reminder rows from `scheduled_for`, requires a target date for non-system notifications, and adds the partial unique index `uq_notifications_reminder_event` on `(user_id, subscription_id, notification_type, target_event_date)` for renewal and trial events.

The original constraints remain in force:

- `(user_id, deduplication_key)` is unique.
- `(user_id, subscription_id)` references the same pair on `subscriptions`, preventing cross-owner associations.
- `is_read` and `read_at` must agree.
- Non-system notifications require a subscription.

New inserts use `INSERT ... ON CONFLICT DO NOTHING`. The explicit logical identity and legacy deduplication key make retries, restarts, and concurrent worker processes safe. A changed target date is a new event; historical content is not overwritten.

## Eligibility rules

| Event | Required status | Required date | Preference |
| --- | --- | --- | --- |
| Renewal | `active` | `next_renewal_date` | Global and renewal reminders enabled |
| Trial expiration | `trial` | `trial_end_date` | Global and trial reminders enabled |

Paused, cancelled, and archived subscriptions are excluded. A reactivated subscription can qualify using its current future event date. Historical notifications are retained after edits, cancellation, archival, or preference changes and state that subscription information may have changed.

The inclusive eligibility window begins on `target date - configured lead days` and ends on the target date. This provides catch-up if the worker misses the threshold day. Dates earlier than the user's current local date do not generate new reminders; overdue projections remain visible in billing without implying payment success or failure.

## Timezones and calendar dates

PostgreSQL renewal/trial fields remain date-only `DATE` values. The injected clock supplies a current instant, while `Intl.DateTimeFormat` derives the current calendar date in the user's validated IANA timezone. Calendar addition uses UTC date components only, avoiding conversion of stored dates into shifting instants. Tests cover UTC boundaries, Asia/Kolkata, America/New_York, leap day, month end, year rollover, and overdue dates.

The worker checks eligibility at its configured interval. It does not promise delivery at a particular local hour.

## Worker architecture and operations

The one-shot job reads eligible subscription/preference rows in bounded batches, applies pure calendar rules, formats stable snapshot text, and atomically inserts notifications. Per-candidate failures are counted so other candidates continue. Safe summaries contain only examined, eligible, created, duplicate, and error counts.

Run one scan:

```powershell
npm run reminders:run-once
```

Start the independent recurring worker:

```powershell
npm run reminders:worker
```

Stop it with `Ctrl+C`. `SIGINT` and `SIGTERM` stop future intervals, wait for an active scan, and close the PostgreSQL pool. The worker prevents overlapping scans inside one process; database uniqueness protects across processes. A crash leaves committed notifications intact, and the next run safely retries unprocessed events.

Configuration:

```dotenv
REMINDER_INTERVAL_MINUTES=60
REMINDER_BATCH_SIZE=500
```

Both values are validated. The interval accepts 1–1440 minutes and batch size accepts 1–5000.

## Protected API

All routes use Stage 4 authentication and derive ownership only from `request.user.id`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/notifications` | Newest-first list; `page`, `limit`, `unreadOnly`, and optional `type` filters |
| `GET` | `/api/v1/notifications/unread-count` | Current user's unread count |
| `PATCH` | `/api/v1/notifications/:id/read` | Idempotently marks one owned notification read |
| `PATCH` | `/api/v1/notifications/read-all` | Marks only the current user's unread rows read |

Unknown or cross-owner IDs return the same non-disclosing 404. Invalid IDs and query parameters return validation errors. SQL values are parameterized.

## React integration

The protected `/notifications` page provides all/unread filtering, pagination, loading/error/empty states, retry, read controls, and links to the existing subscription details route. Text is rendered as ordinary React text; custom service names are never interpreted as HTML.

The authenticated layout includes a keyboard-accessible bell whose label states the unread count. It refreshes after authentication mount, when the tab becomes visible or focused, and after read mutations. It does not use aggressive polling and its state is discarded when the authenticated layout unmounts. Dashboard quick actions link to the Notification Center; projected upcoming renewals and persisted notifications remain separate datasets.

The existing Settings page and preference API already expose the global, renewal, and trial switches, lead days, and IANA timezone, so no duplicate settings model was added.

## Verification

Automated coverage includes deterministic calendar rules, real PostgreSQL creation/idempotency/concurrency, changed target dates, preference/status exclusions, trial and timezone behavior, unchanged payment/renewal data, authenticated pagination/read APIs, cross-user isolation, revoked sessions, frontend states, bell count, read actions, and protected routing.

Use only `spendwise_test` for destructive integration fixtures:

```powershell
npm run test:db
```

For local inspection, run migrations, start the API and worker as separate processes, sign in, configure Settings, and open `/notifications`. Do not seed fictional users unless demo seeding was explicitly enabled.

## Failure recovery, limitations, and Stage 10 readiness

Stage 9 is in-app only: no email, SMS, push, WebSocket, or exact-time local delivery. The scan is bounded but does not provide distributed queue orchestration or production monitoring. Database unavailability fails the run without exposing credentials; a later run retries eligible events. It intentionally leaves recommendation records and AI optimization untouched so Stage 10 can evolve independently without changing reminder identity or financial truth.
