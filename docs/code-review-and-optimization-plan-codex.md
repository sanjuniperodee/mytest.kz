# Bilimland Code Review and Optimization Plan

Generated: 2026-06-17
Repository: `/Users/sanjuniperodee/Projects/bilimland`

## Review Protocol

This report synthesizes a multi-agent production code review across 16 areas:

- auth
- billing
- subscriptions/access
- tests
- questions/bulk import
- admission
- analytics
- notifications
- users
- admin
- misc modules
- common/bootstrap
- web data layer
- web UI
- shared package
- Prisma data layer

Every critical/high finding below was re-read by an adversarial verifier against the real code. Claims that could not be confirmed were removed or downgraded.

## Already Shipped This Session

Do not re-open these as recommendations unless regressions are found:

- OTP verification lockout and async password hashing.
- Refresh-token session persistence with hashed refresh tokens.
- Logout/logout-all refresh-session revocation endpoints.
- Channel membership guard no longer trusts stale JWT `isChannelMember`.
- Redis-backed throttler storage.
- Production startup now checks core JWT/Kaspi secrets, though the placement needs improvement.
- Global validation pipe now forbids non-whitelisted DTO fields where DTOs are actually used.
- Test-answer uniqueness migration and `submitAnswer` composite lookup.
- Normal test start now generates/validates questions before consuming attempts and consumes in a transaction.
- Kaspi/FreedomPay callback hardening, guarded paid/fail transitions, and amount/currency validation.
- Apple IAP cancellation check and optional bundle validation.
- Web proxy raw-error sanitization.

## Executive Summary

The highest-risk areas are account ownership, entitlement metering, admin finance operations, admissions seed correctness, exam integrity, and notification delivery semantics.

The codebase has a solid modular shape, but several production boundaries are still too trusting: admin endpoints often use erased inline TypeScript bodies instead of runtime DTOs, some finance/access decisions are not linked to immutable records, and several UI/API flows assume best-case sequencing. The platform should pause production deployment of the current hardening branch until the critical items below are fixed and tests are updated.

## Critical Findings

| Area | Finding | Evidence | Production Fix | Effort |
|---|---|---|---|---|
| Auth | Email pre-hijacking/account linking. Email/password registration creates an unverified account and returns tokens; Google login later auto-links by email while the old password remains valid. | `apps/api/src/modules/auth/auth.service.ts:336`, `:350`, `:157-171`, `:363-377` | Do not auto-link Google to unverified password accounts. Require verified email ownership before linking, or on Google claim revoke existing sessions and disable/remove the password credential behind an explicit recovery flow. | M |
| Billing/Admin Finance | Kaspi refund race can double-call the external provider. Refund state is checked before the Kaspi call and marked only after the provider returns. | `apps/api/src/modules/admin/services/admin-finance.service.ts:58`, `:70`, `:96` | Add durable idempotency before provider call: `PaymentRefund` table with unique `orderId`, `pending/refunded/failed` state, transaction/advisory lock, and provider idempotency key if available. | M |
| Tests/Access | ENT retake sessions are unmetered. Normal starts consume attempts; retake start directly creates sessions without `assertAndConsumeAttemptTx` or ledger write. | `apps/api/src/modules/tests/test-session.service.ts:274`, `:685` | Create retake sessions inside a transaction and consume an entitlement attempt with the retake `sessionId`, or introduce an explicit retake quota model. | M |
| Admission Data | Grant CSV importer misses `BM086-BM089`, causing BM programs to disappear and matrix cutoffs to roll into `B095` duplicates. | `apps/api/prisma/import-grant-csvs.ts:77-79`, `:101-105`, `:209-212`; `apps/api/prisma/data/grant-admission/programs.csv:100-103`; duplicate seed rows near `grant-admission-seed-data.json:104860` and later | Support `BM` program codes in parser/matcher, clear `currentProgram` on unmatched code-like labels, assert every matrix label matched, regenerate seed JSON, and validate duplicate cutoff keys before seed. | M |

## Verified High Findings

### Auth and Session Security

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Access JWTs are not session-bound and remain usable after logout/admin demotion until expiry. | `apps/api/src/modules/auth/auth.service.ts:460-468`; `apps/api/src/modules/auth/jwt.strategy.ts:17-31`; `apps/api/src/modules/auth/auth.service.ts:431-452`; `apps/api/src/modules/auth/auth.module.ts:23-25` | Add `sid`/`jti` to access tokens and validate active session or token version in `JwtStrategy`; reduce default access TTL. | M |
| Telegram plain-text phone binding can claim unbound phone numbers without ownership proof. | `apps/api/src/modules/telegram/telegram-bot.service.ts:220-259`; `apps/api/src/modules/auth/auth.service.ts:220-241` | Bind phones only from Telegram contact shares where `contact.user_id === from.id`, or require SMS/telecom verification before writing `users.phone`. | M |
| Tokens live in `localStorage`; third-party scripts are loaded and no CSP is configured in repo. | `apps/web/lib/api/storage.ts:10-32`; `apps/web/app/layout.tsx:205-207`; `apps/web/components/auth/google-button.tsx:86-89`; `apps/web/next.config.mjs:8-35` | Move refresh/session to `HttpOnly; Secure; SameSite` cookies, keep access tokens short-lived/in-memory, and add strict CSP headers. | L |
| Web refresh/logout race can restore tokens after sign-out. | `apps/web/lib/api/client.ts:48-67`; `apps/web/lib/api/auth-context.tsx:100-112` | Add auth generation/versioning or compare stored refresh token before writing refreshed tokens; invalidate in-flight refresh on logout/session replacement. | M |

### Access, Entitlements, and Exams

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| `PremiumGuard` accepts any active paid/admin entitlement/subscription without exam-type scoping. | `apps/api/src/common/guards/premium.guard.ts:19`, `:30-40` | Resolve session/body `examTypeId` before premium checks and require a matching entitlement/subscription, with explicit global-plan bypass only. | M |
| Admin entitlement attempt adjustment can reactivate revoked/expired entitlements. | `apps/api/src/modules/admin/services/admin-subscription.service.ts:176-186` | Preserve terminal states (`revoked`, `expired`) or reject adjustments unless status is `active`/`exhausted`; separate deliberate reactivation path. | S |
| Admin subscription grant accepts arbitrary `planType`; unknown non-free plans become unlimited paid access. | `apps/api/src/modules/admin/services/admin-subscription.service.ts:31`; `apps/api/src/modules/subscriptions/access.service.ts:599`, `:607` | Add DTO enum validation and central plan metadata; unknown plans must throw before persistence/sync. | S |
| Explanations are available during in-progress tests for premium users. | `apps/api/src/modules/tests/tests.controller.ts:133-140`; `apps/api/src/modules/tests/test-session.service.ts:584-605` | Require `completed`/`timed_out` session status before returning explanations. | S |
| Answer submission can race with finish, creating persisted score vs review mismatch. | `apps/api/src/modules/tests/test-session.service.ts:403-445`, `:467-484`, `:537-579` | Serialize answer submission and finish with transaction/conditional updates; compute score from the same locked snapshot. | M |
| Web exam can finish while latest optimistic answer save is still pending. | `apps/web/app/exam/[sessionId]/page.tsx:297-312`, `:238-246`, `:445-448` | Track pending saves, disable/await finish until saves settle, and surface failed answer saves inline. | M |
| Student question appeals leak correct answers during active exams. | `apps/api/src/modules/question-appeals/question-appeals.service.ts:123-129`, `:142-147`, `:198`, `:119`; `question-appeals.controller.ts:37-44` | Split student/admin response DTOs. Student create/list responses must not include `questionSnapshot`, `answerOptions.isCorrect`, or explanations. | M |

### Questions, Templates, and Data Integrity

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Question creation/import allows invalid answer sets: zero correct answers or multiple correct `single_choice`. | `apps/api/src/modules/questions/questions.service.ts:31-79`, `:200-244`; `apps/admin/src/pages/QuestionsPage.tsx:850-890` | Central server-side validation: min 2 answers, at least one correct, exactly one correct for `single_choice`, multiple only for `multiple_choice`; mirror in bulk DTO/admin UI. | M |
| Test template sections can reference subjects from another exam type. | `apps/api/src/modules/admin/admin-exams.service.ts:183-206`, `:231-247` | Validate every `subjectId` belongs to the target `examTypeId` in the same transaction; add composite integrity where feasible. | M |

### Admin and Privacy

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Admin user list/detail spreads raw Prisma `User`, exposing sensitive account fields. | `apps/api/src/modules/admin/services/admin-user.service.ts:95`, `:121`, `:290`; `apps/api/prisma/schema.prisma:147` | Use explicit `select`/response DTOs; never return `passwordHash`, provider IDs, auth internals, or unnecessary PII. | M |
| Admin `updateUser` passes request body directly to Prisma without runtime DTO whitelist. | `apps/api/src/modules/admin/admin-users.controller.ts:33`; `apps/api/src/modules/admin/services/admin-user.service.ts:131-132` | Add `UpdateAdminUserDto`, construct explicit Prisma update object, and reject unknown fields. | S |
| Role changes lack actor, self/last-admin guard, super-admin permission, and audit. | `apps/api/src/modules/admin/admin-users.controller.ts:33`; `apps/api/prisma/schema.prisma:162` | Introduce scoped admin roles, pass `CurrentUser`, block self/last-admin removal, require confirmation/reason, audit old/new role. | M |
| Admin user deletion hard-deletes finance/access/test records with no persisted audit. | `apps/api/src/modules/admin/services/admin-user.service.ts:180`, `:188`, `:207` | Replace routine hard delete with soft-delete/anonymization; preserve finance/ledger records; write immutable admin audit event. | L |
| Avatar files remain publicly served after avatar/account deletion. | `apps/api/src/modules/users/users.controller.ts:58`, `:81`; `apps/api/src/main.ts:57` | Track uploaded paths and unlink on replace/delete/account deletion; add orphan cleanup job. | M |

### Billing and Payments

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Refund revocation can deactivate the wrong same-plan subscription because linkage is `paymentNote` or plan/time-window fallback. | `apps/api/src/modules/admin/services/admin-finance.service.ts:101-111` | Persist explicit `paymentOrderId`/provider order reference on subscriptions/entitlements and revoke only exact linked records. | M-L |
| Apple IAP bundle validation is optional when IAP shared secret is configured. | `apps/api/src/modules/billing/billing.service.ts:1233`; `apps/api/src/main.ts:21` | Fail closed when `APPLE_IAP_SHARED_SECRET` is set but `APPLE_IAP_BUNDLE_ID` is missing; validate at startup. | S |

### Notifications and Telegram Operations

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Notifications lack consent/opt-out/mute controls. | `apps/api/prisma/schema.prisma:143`; `apps/api/src/modules/notifications/notifications.service.ts:558`, `:620`; `apps/api/src/modules/telegram/telegram-bot.service.ts:196` | Add notification preference/suppression fields, implement `/stop`, exclude muted users, and treat blocked/deactivated bot errors as suppression. | M |
| Notification kill switch does not block manual admin runs. | `notifications-scheduler.service.ts:19`; `admin-notifications.controller.ts:32`, `:38`; `notifications.service.ts:74` | Enforce `NOTIFICATIONS_ENABLED` inside `runAutomation` or require explicit audited override for manual runs. | S |
| Failed notification dedupe blocks retries forever. | `notifications.service.ts:357`, `:891` | Track retryable vs terminal states, retry with bounded backoff, and dedupe only successful/terminal-suppressed deliveries. | M |
| Scheduler lock can expire during long runs and manual runs bypass distributed lock. | `notifications-scheduler.service.ts:46`, `:52`; `admin-notifications.controller.ts:38` | Use heartbeat/renewed distributed locks or DB-level per-campaign/user claims; include manual runs in same lock. | M |
| Every API process starts Telegram long polling and deletes webhook when token exists. | `telegram.module.ts:7`; `app.module.ts:49`; `telegram-bot.service.ts:183-191`, `:359-377`, `:395-403` | Run bot in exactly one worker via env flag/leader lock, or switch to webhook mode and stop deleting webhook from generic API startup. | M |

### Common/Bootstrap and Deployment

| Finding | Evidence | Fix | Effort |
|---|---|---|---|
| Production config validation runs before Nest `ConfigModule.forRoot`, so `.env` loading order can skip or break validation. | `apps/api/src/main.ts:12-27`; `apps/api/src/app.module.ts:31-33` | Move validation into `ConfigModule.forRoot({ validate })` or load dotenv before checking required production config. | M |
| Reverse-proxy IP handling is incomplete for throttled endpoints. | `apps/api/src/app.module.ts:33-39`; `node_modules/@nestjs/throttler/dist/throttler.guard.js:141-142`; `apps/api/src/main.ts:27-56` | Set Express `trust proxy` for known nginx hop/CIDR or provide trusted forwarded-IP `getTracker`. | S |
| Shutdown hooks are incomplete; Telegram service installs signal listeners while Nest shutdown hooks are not enabled. | `apps/api/src/modules/telegram/telegram-bot.service.ts:293-307`; `apps/api/src/main.ts:77-81`; `apps/api/src/database/redis.module.ts:7-13` | Use `OnApplicationShutdown` for bot cleanup and call `app.enableShutdownHooks()` in bootstrap. | M |

## Confirmed Medium Findings

These are not first-wave production blockers, but should be scheduled after critical/high remediation:

- Analytics date-only `to` ranges exclude the selected day after midnight.
- Analytics registration metrics count later-attributed old visits as registrations in the visit period.
- Admission `cutoffSource`/`GRANT_FALLBACK` is omitted from web/shared types and UI.
- Migration safety checker fails on the reviewed `DELETE FROM test_answers` migration; add explicit migration approval marker or move cleanup to a backfill.
- Media proxy can fetch arbitrary API-origin GET paths; restrict prefixes and content types.
- Apple IAP receipt freshness/replay handling should reject expired subscription receipts and stale consumables.
- Apple verification fetch needs timeout.
- Auth refresh rotation should be atomic compare-and-swap on old hash.
- Auth controllers need DTOs instead of raw `@Body('field')` and inline erased types.
- LocalStorage token storage also affects admin.
- Admin subscription/plan/entitlement bodies need DTO validation and audit fields.
- Finance reporting should model refunds as first-class records and show gross/refunded/net.
- Leads should be durably stored before Telegram delivery.
- Leaderboard should reduce public identifiers or add privacy opt-in.
- DB snapshots should run from a single worker/cron with lock and explicit enablement.
- Redis should be pinged/readiness-checked in production and `REDIS_URL` should be validated if Redis is now a hard dependency.
- Question duplicate handling needs normalized content fingerprint/import modes.
- CSV export needs one BOM, proper answer labels, and CSV/formula escaping.
- Seed scripts should not delete cutoffs for cycles absent from the seed payload.
- Topic reseed scripts need appeal-safe question preservation/versioning.
- Prisma should enforce hierarchy consistency where possible with composite keys/FKs.
- `TestAnswer.selectedIds` should be validated against the question's answer options or normalized.
- Web dashboard/admission/exam pages need distinct error states instead of empty-state fallthrough.
- Checkout/deep-link URLs should be scheme/host allowlisted.
- Landing page is currently hardcoded and does not consume admin-managed landing settings.
- Shared ENT/admission DTOs drift from actual API responses and duplicated web scoring constants.

## Refuted or Downgraded During Verification

- DB snapshot exposure/destructive route was refuted: no exposed snapshot controller was found.
- Analytics date range and registration attribution were downgraded from high to medium.
- Admission cutoff-source UI drift was downgraded from high to medium.
- Migration safety failure was downgraded from high to medium because it blocks deploy tooling rather than runtime users.
- Media proxy arbitrary path was downgraded from high to medium.
- Admin raw user spread was adjusted from critical to high: serious admin PII exposure, but admin-authenticated rather than public.
- SWR stale cache and refresh race are high-plausible privacy/session issues but may be treated as medium if user switching in the same tab is not a supported workflow.
- Shutdown lifecycle is high/medium operational risk, not a direct security issue.

## Prioritized Remediation Plan

### P0: Block Deployment Until Fixed

1. Fix email pre-hijacking and Google linking semantics.
2. Add refund idempotency/locking before Kaspi provider calls.
3. Consume entitlement attempts for ENT retakes.
4. Fix BM admission importer, regenerate seed JSON, and add seed assertions.
5. Stop student appeal responses from returning correct-answer snapshots.
6. Require finished session status before explanations and serialize answer/finish state.

### P1: Access, Admin, and Payment Hardening

1. Bind access JWTs to revocable sessions or token versions; reduce TTL.
2. Scope `PremiumGuard` to session/body `examTypeId`.
3. Validate admin subscription plan types and prevent entitlement reactivation through usage adjustment.
4. Add DTOs/selects for admin user APIs; remove raw Prisma spreads and direct body-to-Prisma updates.
5. Add admin role-change permissioning, last-admin/self guards, and immutable audit events.
6. Persist explicit payment-order links on entitlements/subscriptions.
7. Enforce Apple IAP bundle env when IAP is enabled.

### P2: Operational Reliability

1. Move production config validation into `ConfigModule`.
2. Configure trusted proxy IP handling for throttled routes.
3. Add shutdown hooks and convert Telegram cleanup to Nest lifecycle hooks.
4. Run Telegram bot polling in one worker or switch to webhooks.
5. Add notification preferences, retry state, kill-switch enforcement, and distributed run locking.
6. Add Redis production readiness checks.

### P3: Data Quality and Maintainability

1. Add server-side answer-set validation and template subject/exam validation.
2. Repair failing focused tests after transaction/Redis changes.
3. Add migration safety approval for reviewed cleanup migrations.
4. Align shared DTOs and web/admin admission types with API responses.
5. Improve analytics date handling and registration metrics.
6. Add durable lead outbox/storage.
7. Add media/avatar cleanup and URL allowlists.

## Suggested Production-Ready Refactor Targets

### Admin Audit Model

Introduce an immutable admin audit table covering role changes, user deletes/anonymization, entitlement changes, manual notification runs, refunds, and finance adjustments.

Minimum fields:

- `id`
- `actorUserId`
- `targetType`
- `targetId`
- `action`
- `reason`
- `before`
- `after`
- `createdAt`
- request metadata such as IP/user agent where available

### Payment Refund Model

Move refunds out of mutable `providerPayload` flags.

Minimum fields:

- `id`
- `paymentOrderId` unique for one full refund, or unique `(paymentOrderId, refundType, amount)`
- `provider`
- `providerRefundId`
- `status`: `pending`, `succeeded`, `failed`
- `amount`
- `currency`
- `requestedBy`
- `requestedAt`
- `completedAt`
- `failureReason`

### Entitlement Scope Model

Normalize access checks around:

- plan code validated against central metadata
- explicit `examTypeId` or global scope
- active window
- terminal entitlement state
- attempt ledger tied to `sessionId`

Premium guards should call one access service method with the resolved target exam type instead of checking broad paid state.

### Notification Delivery Model

Add preference and retry semantics:

- user-level `notificationsMutedAt` or preference table
- `/stop` and suppression handling
- `retryCount`, `nextAttemptAt`, `lastErrorCode`
- terminal vs retryable error classification
- distributed run lock or per-candidate claim

### Admission Import Safety

Make the importer fail closed:

- every code-like matrix header must match a known program
- every generated cutoff key `(cycle, university, program, quota)` must be unique
- unknown labels are reported and fail CI
- seed deletes only cycles present in input unless full-reseed mode is explicit

## Verification Notes

Commands previously run successfully during this session:

- `npx tsc -p tsconfig.json --noEmit` in `apps/api`
- `npx jest --config ./test/jest-e2e.json --runInBand test/admission.http.spec.ts test/freedompay-signature.http.spec.ts`
- `npx prisma validate`
- `npm run build` in `apps/api`
- `npm run lint` in `apps/admin`
- `git diff --check`

Known verification gaps:

- Web build previously failed under Turbopack native bindings and hung under Webpack.
- Admin build previously hung after TypeScript/Vite start; lint passed.
- Focused `ent-consistency.http.spec.ts` and current admission spec need mock updates for `$transaction` and `REDIS_CLIENT`.

