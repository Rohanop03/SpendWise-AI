# Requirements

## 1. Requirement Conventions

- **Must** indicates required behavior for the MVP unless a roadmap stage states otherwise.
- Acceptance criteria describe an observable condition that can later be verified by an API, database, integration, or user-interface test.
- All user-owned operations require authentication and server-side ownership enforcement.
- Planned behavior in this document is not an assertion that the feature is currently implemented.

## 2. Functional Requirements

### 2.1 Authentication

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-AUTH-01 | The system must allow a visitor to register with a unique email address and password. | A valid unused email creates one account; a duplicate normalized email is rejected with a clear conflict response. |
| FR-AUTH-02 | The system must validate registration and login input. | Missing or invalid fields receive field-appropriate validation errors and do not create a session or account. |
| FR-AUTH-03 | The system must hash passwords before persistence. | No plaintext password is stored or returned, and a stored password hash can be verified by bcrypt during login. |
| FR-AUTH-04 | The system must authenticate valid credentials and issue a time-limited JWT-based session credential. | Valid credentials return an authenticated response; invalid credentials return a generic unauthorized response without revealing whether the email exists. |
| FR-AUTH-05 | The system must support logout. | After logout, the client removes its active credential; any server-managed refresh/session credential, if implemented, is invalidated according to the Stage 4 design. |
| FR-AUTH-06 | The system must protect user-only routes. | Requests without a valid, unexpired credential receive an unauthorized response. |
| FR-AUTH-07 | The system must isolate user-owned data. | Authenticated user A cannot read or modify user B's subscriptions, payments, notifications, recommendations, or preferences, including by changing identifiers. |
| FR-AUTH-08 | The system must allow a user to view and update supported profile fields. | Valid changes are persisted and returned on the next profile request; protected identity fields follow explicit validation and uniqueness rules. |

### 2.2 Subscription Management

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-SUB-01 | A user must be able to create a subscription with service, category, price, currency, billing cycle, start date, next renewal date, and status. | Valid input creates one user-owned subscription and returns its stored values; invalid prices, dates, currencies, cycles, or statuses are rejected. |
| FR-SUB-02 | A user must be able to view their subscriptions. | The list contains only records owned by the authenticated user and supports a stable documented sort order. |
| FR-SUB-03 | A user must be able to view a single subscription and its relevant details. | An owned identifier returns the record; a missing or unowned identifier does not disclose another user's record. |
| FR-SUB-04 | A user must be able to edit an owned subscription. | Valid changes persist without replacing unrelated fields; unowned records cannot be changed. |
| FR-SUB-05 | A user must be able to delete an owned subscription subject to the selected history policy. | The operation applies only to the owned record and preserves or removes related history according to the Stage 3 referential-integrity decision. |
| FR-SUB-06 | The system must support active, paused, trial, and cancelled statuses. | Only supported statuses are accepted, and status filters return matching owned records. |
| FR-SUB-07 | A user must be able to search subscriptions by service name. | A case-insensitive search returns only owned subscriptions whose service names match the documented search behavior. |
| FR-SUB-08 | A user must be able to filter subscriptions by category, status, billing cycle, and currency. | Combining supported filters returns only records satisfying every supplied filter. |
| FR-SUB-09 | The system must support monthly, quarterly, and yearly billing cycles initially. | Each accepted cycle is stored consistently and produces the documented cost normalization. |
| FR-SUB-10 | The system must preserve price history through payment records rather than rewriting historical payment amounts. | Changing a subscription's current price changes future estimates but does not alter previously recorded payment amounts. |

### 2.3 Billing and Payments

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-PAY-01 | A user must be able to record a payment for an owned subscription. | Valid amount, currency, billing date, and status create one related payment; an unowned subscription identifier is rejected. |
| FR-PAY-02 | The system must distinguish expected payments from completed payments. | Creating or projecting a renewal does not mark it completed; only an explicit valid action records a completed payment. |
| FR-PAY-03 | A user must be able to view payment history for their subscriptions. | Results contain only payments connected to the authenticated user's subscriptions and can be ordered by billing date. |
| FR-PAY-04 | A user must be able to correct permitted payment details. | A valid edit updates the selected owned payment and maintains audit/consistency rules defined in Stage 3. |
| FR-PAY-05 | The system must calculate expected recurring costs from current subscription terms. | For each active or otherwise included status, the calculation follows the documented billing normalization and never presents the result as a completed charge. |
| FR-PAY-06 | The system must identify upcoming expected payments using renewal dates. | A date-window query returns qualifying owned subscriptions without creating completed-payment history. |
| FR-PAY-07 | Historical reports must use recorded payment amount and currency. | Later subscription price edits do not change totals produced for already-recorded payments. |

### 2.4 Dashboard and Analytics

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-AN-01 | The dashboard must show the number of active subscriptions. | The count includes only the authenticated user's records with the defined active status. |
| FR-AN-02 | The dashboard must show estimated monthly and yearly recurring expenditure. | Totals use the normalization rules below, state which statuses are included, and remain separated by currency. |
| FR-AN-03 | The system must show category-wise estimated spending. | Every included subscription contributes to its category total exactly once, grouped by currency. |
| FR-AN-04 | The system must show historical spending trends from payments. | Trend values include only payment statuses defined as realized spending and use the recorded payment date and amount. |
| FR-AN-05 | The system must show upcoming renewals for a configurable or documented date window. | The list is ordered by renewal date and includes only qualifying owned subscriptions. |
| FR-AN-06 | The system must identify the most expensive subscriptions. | Records are ranked using normalized cost within the same currency, with the calculation basis visible or documented. |
| FR-AN-07 | Analytics must distinguish estimates from actual historical totals. | Every metric is labeled as estimated recurring cost or recorded payment history; the two are not silently combined. |
| FR-AN-08 | Analytics must handle an empty account. | A user with no qualifying data receives zero/empty states rather than errors or fabricated figures. |

#### Billing-Cycle Normalization Rules

For a subscription price `P`:

| Billing cycle | Estimated monthly cost | Estimated yearly cost |
| --- | ---: | ---: |
| Monthly | `P` | `P × 12` |
| Quarterly | `P ÷ 3` | `P × 4` |
| Yearly | `P ÷ 12` | `P` |

Rules and presentation constraints:

- Calculations use a fixed-precision decimal representation, not binary floating point.
- Aggregation occurs without rounding each intermediate row; display rounding occurs at the reporting boundary using the currency's supported precision.
- MVP totals are grouped by currency. Values in different currencies are not added together.
- Active subscriptions are included by default. Trial subscriptions with a non-zero committed renewal price may be shown separately or included only when the metric clearly labels that policy. Paused and cancelled subscriptions are excluded from forward estimates by default.
- Recorded-payment analytics use persisted payment amounts and statuses, not normalized current prices.

### 2.5 Reminders and Notifications

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-NOT-01 | A user must be able to configure whether renewal and trial reminders are enabled and how many days in advance they occur. | Valid settings persist per user; out-of-range values are rejected. |
| FR-NOT-02 | A scheduled process must identify qualifying renewals and trial expirations in a later implementation stage. | Running the job for a date produces notifications only for enabled users and qualifying owned subscriptions. |
| FR-NOT-03 | The system must avoid duplicate notifications for the same reminder occurrence. | Re-running the scheduler for the same user, subscription, reminder type, and due occurrence does not create a duplicate. |
| FR-NOT-04 | A user must be able to view their in-app notifications. | The notification center lists only the authenticated user's notifications in reverse chronological order. |
| FR-NOT-05 | A user must be able to mark notifications as read. | The selected owned notification changes from unread to read and remains so on subsequent requests. |
| FR-NOT-06 | A notification must remain a reminder, not proof of a charge. | Reminder content describes an expected event and does not create or complete a payment. |

### 2.6 AI Recommendations

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-AI-01 | The system must generate deterministic baseline recommendations from the authenticated user's stored data. | Re-running the same rules on unchanged data produces equivalent recommendation facts and does not use fabricated values. |
| FR-AI-02 | The system must detect potentially overlapping services using defined service/category comparison rules. | A recommendation identifies the compared subscriptions and the rule that triggered it; it does not state that either service is unused. |
| FR-AI-03 | The system must flag unusually expensive subscriptions using a documented comparison rule. | The result identifies the comparison group, threshold/basis, and source subscription amount in the same currency. |
| FR-AI-04 | The system must analyze spending concentration by category. | A concentration recommendation is created only when the documented share threshold is met and sufficient comparable data exists. |
| FR-AI-05 | Recommendations must include a human-readable reason and evidence. | The response names the triggering facts and provides a traceable rule identifier or type. |
| FR-AI-06 | Potential savings must be presented as an estimate. | The displayed savings includes an estimation label, currency, period, and calculation basis and is never described as guaranteed. |
| FR-AI-07 | Users must be able to dismiss or otherwise resolve a recommendation. | The selected owned recommendation records its new state and no other user's recommendation is affected. |
| FR-AI-08 | Optional LLM output must be grounded in validated rule results. | If enabled later, the LLM receives only required data, cannot change calculated values, and failure falls back to the deterministic explanation. |

### 2.7 User Preferences

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-PREF-01 | The system must store one set of preferences per user. | Creating an account results in usable defaults, and repeated updates do not create multiple active preference records. |
| FR-PREF-02 | A user must be able to select a display time zone from supported values. | Valid changes affect date presentation and reminder date evaluation without altering stored historical instants. |
| FR-PREF-03 | A user must be able to select a preferred display currency. | The preference controls defaults and labels but does not cause unsupported cross-currency conversion. |
| FR-PREF-04 | A user must be able to configure supported reminder settings. | Updated lead time and enablement choices are used by the next eligible reminder evaluation. |
| FR-PREF-05 | The system must provide safe defaults when preferences have not been customized. | A new user can use the application without manually creating preference values. |

## 3. Non-Functional Requirements

### 3.1 Security

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-SEC-01 | Passwords must be hashed with bcrypt using a documented, configurable cost appropriate to the deployment environment. | Automated tests and database inspection confirm no plaintext password persistence. |
| NFR-SEC-02 | Secrets, database credentials, and signing keys must come from environment configuration and must not be committed. | Repository review finds only documented example variables without live secrets. |
| NFR-SEC-03 | Every protected endpoint must authenticate the request and enforce resource ownership server-side. | Authorization tests cover unauthenticated, owned, and unowned-resource cases. |
| NFR-SEC-04 | SQL must use parameterized queries. | Code review finds no user input interpolated into SQL text. |
| NFR-SEC-05 | Input must be validated at the API boundary, with database constraints as a second line of defense. | Invalid or unexpected values are rejected consistently and do not corrupt stored data. |
| NFR-SEC-06 | Production deployment must use HTTPS and restrictive cross-origin configuration. | Deployment configuration documents TLS termination and allowed origins; no claim is made before deployment testing. |

### 3.2 Maintainability

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-MNT-01 | Frontend, backend, database, and documentation concerns must have clear boundaries. | Repository structure and module dependencies follow the Stage 2 architecture. |
| NFR-MNT-02 | Formatting, linting, naming, error, and API response conventions must be documented and consistently applied. | Quality commands run without unresolved violations once tooling is introduced. |
| NFR-MNT-03 | Database changes must be versioned through ordered migrations. | A clean database can be reproduced from migrations in a documented order. |
| NFR-MNT-04 | Business calculations and recommendation rules must be centralized and testable. | Each rule has focused tests rather than duplicated logic across routes or UI components. |

### 3.3 Performance

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-PERF-01 | Common list endpoints must support pagination or a documented bounded result size before data volumes require it. | Tests verify limits and stable ordering. |
| NFR-PERF-02 | Common user, status, category, payment-date, and renewal-date access paths must be evaluated for indexing. | Stage 11 records `EXPLAIN ANALYZE` evidence before and after justified indexes. |
| NFR-PERF-03 | Initial performance targets must be measured rather than assumed. | Before deployment, representative local test data and hardware are documented with baseline response-time results for key endpoints. |

### 3.4 Reliability

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-REL-01 | Multi-step operations that must succeed or fail together must use database transactions. | Failure-injection tests show no partial state after rollback. |
| NFR-REL-02 | Reminder and recommendation jobs must be safe to retry. | Duplicate-prevention tests show equivalent reruns do not create duplicate logical results. |
| NFR-REL-03 | The API must fail predictably if PostgreSQL or an optional AI provider is unavailable. | The system returns controlled errors; optional AI failure does not invent a recommendation or corrupt data. |

### 3.5 Scalability

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-SCL-01 | The API should remain stateless for ordinary authenticated requests unless a documented session component is introduced. | Multiple API instances can process requests using shared persistent state and compatible signing configuration. |
| NFR-SCL-02 | Background work must be separated conceptually from request processing. | Scheduler responsibilities and idempotency boundaries are documented before Stage 9 implementation. |
| NFR-SCL-03 | Scaling claims must be supported by later load tests. | Documentation reports measured limits and environment details rather than using unsupported production-scale claims. |

### 3.6 Accessibility

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-ACC-01 | Core workflows should target WCAG 2.1 AA principles. | Keyboard navigation, visible focus, form labels, semantic structure, contrast, and error announcements are checked during frontend testing. |
| NFR-ACC-02 | Charts must not be the only representation of essential information. | Each essential chart has an accessible text summary, labels, or tabular alternative. |

### 3.7 Responsiveness

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-RSP-01 | Core pages must remain usable on supported mobile, tablet, and desktop viewport ranges. | Stage 8 manual and automated checks cover representative widths without clipped controls or inaccessible content. |

### 3.8 Error Handling

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-ERR-01 | The API must use consistent status codes and a documented error shape. | Validation, authentication, authorization, conflict, not-found, and server-error tests assert the contract. |
| NFR-ERR-02 | User-facing errors must be actionable without exposing stack traces, SQL, secrets, or internal identifiers. | Production-mode responses are sanitized while server logs retain appropriate diagnostic context. |
| NFR-ERR-03 | Logs must include useful request/job context while excluding passwords, JWTs, and unnecessary personal data. | Logging review and tests verify sensitive-field redaction. |

### 3.9 Data Privacy

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-PRV-01 | The application must collect only data needed for documented features. | Schema and API reviews map every personal field to a requirement. |
| NFR-PRV-02 | Optional external AI integration must minimize and explicitly document transmitted data. | Provider-bound payloads exclude credentials and unnecessary identifying data and are covered by configuration and privacy documentation. |
| NFR-PRV-03 | Data export and account deletion policy must be decided before public deployment. | The deployment checklist records retention, deletion, backup, and recovery behavior. |

### 3.10 Database Integrity

| ID | Requirement | Verification target |
| --- | --- | --- |
| NFR-DB-01 | The relational design must use primary keys, foreign keys, and justified `NOT NULL`, `UNIQUE`, `CHECK`, and `DEFAULT` constraints. | Migration tests demonstrate acceptance of valid data and rejection of invalid or orphaned data. |
| NFR-DB-02 | The schema should meet 3NF where appropriate, with any denormalization documented and justified. | Stage 3 normalization analysis identifies functional dependencies and design decisions. |
| NFR-DB-03 | Referential actions must explicitly define behavior for subscription history and user deletion. | Integration tests confirm the selected restrict, cascade, soft-delete, or archival policies. |
| NFR-DB-04 | Monetary values must use fixed-precision database types and validated currency codes. | Precision, non-negative-value, and currency validation tests pass without float rounding artifacts. |
| NFR-DB-05 | Database views, triggers, functions, and indexes must have meaningful use cases and tests. | Each advanced object maps to a documented requirement and is evaluated for correctness and performance. |

## 4. Traceability Notes

- Authentication requirements support every workflow that touches user-owned records.
- Subscription terms drive forward-looking estimates; payment records drive historical analytics.
- Preferences configure display and reminder behavior but do not rewrite financial history.
- Rule-based recommendations remain the source of truth even if an LLM later improves explanation wording.
- Detailed tables, keys, data types, constraints, and deletion policies are intentionally deferred to Stage 3.
