# Production Code Review and Optimization Plan

Date: 2026-06-16
Repository: `/Users/sanjuniperodee/Projects/bilimland`

## Executive Summary

Bilimland is a multi-app exam preparation platform with a NestJS API, Prisma/PostgreSQL persistence, Redis-backed operational flows, a Next.js web app, a Vite/React admin app, and shared TypeScript business rules for ENT scoring/admission behavior.

The codebase has a solid modular foundation, especially around Nest modules, Prisma schema organization, admission repositories, and shared scoring utilities. The largest production risks are concentrated in four areas:

1. Payment and entitlement finalization must be fail-closed, idempotent, and amount-verified across all providers.
2. Test-session creation and attempt consumption must become one durable lifecycle so users cannot lose paid attempts on partial failures.
3. Auth/session security needs revocable refresh sessions, stronger OTP/login controls, and reduced token exposure in browsers.
4. Frontend/deployment configuration has drifted from Vite to Next.js and must be aligned before relying on CI/E2E/deploy signals.

This document consolidates a multi-agent review across backend/security, business logic/data correctness, and frontend/platform maintainability.

## Implementation Status

Updated: 2026-06-16

Completed in the first implementation pass:

- Kaspi webhook now fails closed when `KASPI_WEBHOOK_SECRET` is missing and rejects invalid signatures.
- Kaspi paid finalization validates amount and currency before granting access.
- FreedomPay callback finalization is idempotent, provider-checked, and amount/currency-checked.
- Test start now creates the session and consumes the attempt in one transaction after question generation/validation.
- `AttemptUsageLedger.sessionId` is populated for successful v2 test starts.
- `TestAnswer` now has a unique `(sessionId, questionId)` database invariant with a cleanup migration.
- Answer submission uses the composite unique lookup.
- Web Vercel and Playwright config now target the current Next.js app instead of the old Vite contract.
- Next metadata filenames were normalized to `robots.ts` and `sitemap.ts`, with `my-test.kz` as the default canonical host.
- API proxy errors no longer expose raw upstream exception text to clients.
- Production startup config now fails fast for JWT secrets and Kaspi webhook secret.
- Global validation now rejects non-whitelisted DTO fields.
- Channel membership guard no longer trusts a stale positive JWT claim as the only source of truth.
- Web OTP verification now has per-phone Redis failure lockout.
- Redis client now disables unbounded offline queueing, caps request retries, and closes on app shutdown.
- Admission chance results now require ENT subject thresholds for `isPass` and expose `cutoffSource` for rural fallback cases.
- Apple IAP receipt handling now checks optional bundle ID, rejects cancelled transactions, and treats concurrent duplicate transaction creation as idempotent reuse.
- Refresh tokens are now backed by `AuthSession` rows, stored as hashes, rotated on refresh, revoked on logout/logout-all, and token-family reuse revokes the family.
- Web and admin logout now call `/auth/logout` before clearing local token state.
- Nest throttling now uses Redis-backed storage, sharing rate limits across API processes.

Verification completed:

- `npx tsc -p tsconfig.json --noEmit` in `apps/api`
- `npx jest --config ./test/jest-e2e.json --runInBand test/admission.http.spec.ts test/freedompay-signature.http.spec.ts`
- `npx prisma validate` in `apps/api`
- `npm run build` in `apps/api`
- `npm run lint` in `apps/admin`

Still open:

- Moving browser refresh tokens from `localStorage` to httpOnly secure cookies or a BFF session model.
- Strong Apple IAP user binding via `appAccountToken` or server purchase nonce, plus refund/revocation modeling.
- Moving Kaspi setup UI out of the user dashboard and into admin/ops.
- Reconnecting current Next landing hero to `/public/landing-settings` or removing dead admin controls.
- Optimizing large question-bank random selection and admission chance caching.
- Persisted score snapshots/versioning.
- Full Next web build remains blocked locally because the build process hangs after switching to Webpack on this machine; API build is passing.

## Current Architecture Snapshot

- API: `apps/api`, NestJS modules under `src/modules`, Prisma schema and migrations under `apps/api/prisma`.
- Web: `apps/web`, currently a Next.js app using route handlers as an API/media proxy and localStorage token storage.
- Admin: `apps/admin`, Vite/React/Ant Design app for operations and content/admin workflows.
- Shared package: `packages/shared`, ENT scoring and common validators/types.
- Persistence: PostgreSQL via Prisma, Redis for OTP/auth codes, Kaspi sessions, rate-sensitive operations, and scheduler locks.
- Payments: Kaspi POS, FreedomPay, and Apple IAP all finalize subscriptions through `BillingService`.

## P0 Critical Fixes

### 1. Fail Closed on Kaspi Webhook Signatures

Finding:
`POST /billing/kaspi/webhook` is public. Signature validation in `BillingService.handleKaspiWebhook()` is conditional on `KASPI_WEBHOOK_SECRET`; if the secret is unset, webhook bodies can be accepted.

Risk:
An attacker who obtains or guesses a pending Kaspi `providerOrderId` can submit a forged `payment.success` event and activate a subscription.

Recommended implementation:

- Require `KASPI_WEBHOOK_SECRET` in production startup config validation.
- In `handleKaspiWebhook()`, reject if the secret is missing in production.
- Update `.env.example` to mark this secret as required for any deployed environment.
- Add tests:
  - secret missing in production rejects;
  - invalid signature rejects;
  - valid signature succeeds.

Files:

- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `.env.example`

### 2. Validate Kaspi Amount/Currency Before Entitlement Grant

Finding:
Kaspi paid finalization creates subscriptions without validating provider amount/currency against the local `PaymentOrder`.

Risk:
Incorrect or malicious callback payloads can grant the wrong entitlement or activate access for mismatched payment data.

Recommended implementation:

- Extract a provider-neutral `finalizePaidOrder()` flow:
  - verify provider;
  - verify order status transition;
  - verify amount and currency;
  - verify provider event identity;
  - update order with guarded `updateMany`;
  - create subscription/entitlements;
  - write audit/analytics event.
- Apply the same invariant to Kaspi, FreedomPay, and Apple IAP.

Files:

- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/src/modules/billing/kaspi-pos.service.ts`

### 3. Make Test Start Durable and Attempt-Safe

Finding:
`TestSessionService.startTest()` consumes an attempt before question generation and session creation. Failures after consumption can burn limited/free/paid attempts without a usable session. The usage ledger can also be written with `sessionId: null`.

Risk:
Paid users can lose attempts due to transient errors, insufficient question banks, DB write failures, or deployment interruptions.

Recommended implementation:

- Generate and validate question selection before consuming an attempt, or create a pending session first.
- Move the final reservation/session creation/ledger write into one durable transaction.
- Ensure `AttemptUsageLedger.sessionId` is filled for successful starts.
- Add a compensation path only for unavoidable external failures.
- Add tests for generation failure, DB failure, concurrent starts, and ledger/session linkage.

Files:

- `apps/api/src/modules/tests/test-session.service.ts`
- `apps/api/src/modules/subscriptions/access.service.ts`
- `apps/api/prisma/schema.prisma`

### 4. Add Unique Constraint for Test Answers

Finding:
`TestAnswer` has indexes on `(sessionId, questionId)` but no uniqueness constraint. `submitAnswer()` uses `findFirst()`, while scoring can count duplicate rows.

Risk:
Duplicate answer rows can corrupt scoring and review output.

Recommended implementation:

- Add Prisma unique constraint: `@@unique([sessionId, questionId])`.
- Add migration cleanup script to detect and resolve existing duplicates before applying the constraint.
- Change `submitAnswer()` to update by unique composite key once available.

Files:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/tests/test-session.service.ts`
- `apps/api/src/modules/tests/test-scorer.service.ts`

### 5. Fix Web Deployment and E2E Contract Drift

Finding:
Root `vercel.json` filters `@bilimland/web` and expects `apps/web/dist`, but `apps/web/package.json` names the app `mytest-v2` and builds Next.js output. Playwright config starts Vite for the web app, while the web app is now Next.js.

Risk:
Deployments and E2E tests can pass against the wrong contract or fail for reasons unrelated to product correctness.

Recommended implementation:

- Choose the canonical package name for `apps/web`.
- Update root Vercel config to build/deploy the Next.js app correctly.
- Update Playwright `webServer` to run `npm run dev` or `next dev` for `apps/web`.
- Update docs and AGENTS guidance to remove stale Vite/5173 instructions for the current web app.

Files:

- `vercel.json`
- `playwright.config.ts`
- `apps/web/package.json`
- `AGENTS.md`

## P1 Security and Reliability Hardening

### 6. Replace Stateless Refresh JWTs With Revocable Sessions

Current issue:
Refresh tokens are long-lived JWTs. The server verifies signature and user existence but cannot revoke a single device/session or detect token reuse.

Recommended implementation:

- Add `UserSession` or `RefreshSession` table:
  - `id`, `userId`, `jtiHash`, `familyId`, `rotatedFromId`, `expiresAt`, `revokedAt`;
  - device metadata, IP hash, user agent hash;
  - created/lastUsed timestamps.
- Rotate refresh tokens on every refresh.
- Revoke token family on reuse detection.
- Add logout and logout-all-devices endpoints.
- Move refresh token storage to httpOnly secure SameSite cookies where possible.

Files:

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/lib/api/storage.ts`
- `apps/admin/src/api/client.ts`

### 7. Move Browser Token Storage Out of `localStorage`

Current issue:
Web and admin persist access/refresh tokens in `localStorage`, increasing XSS blast radius.

Recommended implementation:

- Prefer an httpOnly secure cookie for refresh/session.
- Keep access tokens memory-only where possible.
- For admin, use a dedicated session boundary and short access-token lifetime.
- Add Content Security Policy and remove inline/script-unsafe patterns before rollout.

Files:

- `apps/web/lib/api/storage.ts`
- `apps/web/lib/api/client.ts`
- `apps/admin/src/api/client.ts`
- `apps/api/src/main.ts`

### 8. Redis-Backed Throttling and Per-Identity Lockouts

Current issue:
Nest throttling is process-local. OTP/login protection multiplies by PM2/instance count.

Recommended implementation:

- Configure a Redis-backed throttler store.
- Add explicit Redis counters for:
  - OTP request per phone;
  - OTP verify failures per phone;
  - email login failures per email/IP;
  - Google/Telegram auth anomalies.
- Add lockout response metadata where safe.

Files:

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/database/redis.module.ts`

### 9. Recheck Channel Membership From Trusted State

Current issue:
`ChannelMemberGuard` trusts `isChannelMember` from JWT if true. Users removed from the Telegram channel retain access until token expiry.

Recommended implementation:

- Store channel membership with `channelCheckedAt`.
- In guard, read DB state and recheck Telegram on TTL.
- Avoid embedding authorization-critical membership claims as the only source of truth.

Files:

- `apps/api/src/common/guards/channel-member.guard.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/auth/auth.service.ts`

### 10. Harden Apple IAP Verification

Current issue:
Receipt verification grants the caller access based on a matching product and first redemption. It does not strongly bind receipt/app/user before granting.

Recommended implementation:

- Validate `bundle_id`, environment, product ID, cancellation/refund fields, and transaction ownership.
- Use `appAccountToken` or a server-created purchase nonce when available.
- Add unique constraints for provider transaction IDs.
- Model refunds/revocations as entitlement state transitions.

Files:

- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/prisma/schema.prisma`

## P1 Business Logic and Data Correctness

### 11. Apply ENT Thresholds in Admission Chance Results

Current issue:
Admission chance lists use total score for `isPass`, but ENT threshold checks exist in shared scoring logic.

Recommended implementation:

- Use `compareEntToCutoff()` for chance programs/universities.
- Return:
  - `total`;
  - `passesThresholds`;
  - `isPass`;
  - `gapToCutoff`;
  - failing subject threshold details.
- Update UI copy so high total scores with failed subject thresholds are not shown as passing.

Files:

- `apps/api/src/modules/admission/admission.service.ts`
- `packages/shared/src/entGrantModel.ts`
- `packages/shared/src/admissionCompare.ts`

### 12. Make Rural Quota Fallback Explicit

Current issue:
Rural quota chance falls back to grant cutoff if rural cutoff is missing.

Recommended implementation:

- Keep fallback only if business confirms it.
- Add `displayedQuotaType` and `cutoffSource` to API responses.
- In UI, label fallback as grant cutoff, not rural cutoff.

Files:

- `apps/api/src/modules/admission/domain/chance-cutoffs.ts`
- `apps/api/src/modules/admission/admission.service.ts`
- `apps/web/components/admission/*`

### 13. Centralize Plan Attempt Rules

Current issue:
Plan attempt rules are duplicated across billing/access/user profile code.

Recommended implementation:

- Create one plan policy module with:
  - duration;
  - total attempts;
  - daily attempts;
  - product/provider mapping;
  - display metadata.
- Use this policy from billing, access checks, admin display, and user profile.

Files:

- `apps/api/src/modules/billing/billing.config.ts`
- `apps/api/src/modules/subscriptions/access.service.ts`
- `apps/api/src/modules/users/users.service.ts`
- `packages/shared/src/*`

## P2 Scalability and Performance

### 14. Optimize Question Selection

Current issue:
Question generation loads large question pools and all seen question IDs into memory.

Recommended implementation:

- Filter seen questions by exam/subject/window.
- Use DB-level random sampling or precomputed question buckets.
- Store per-user recent question history in bounded windows.
- Add pool-size metrics and alerts for insufficient question banks.

Files:

- `apps/api/src/modules/tests/test-generator.service.ts`
- `apps/api/prisma/schema.prisma`

### 15. Cache and Page Admission Chance Queries

Current issue:
Admission chance can load up to 15,000 rows and group in memory.

Recommended implementation:

- Add Redis or materialized-cache layer per cycle/quota/profile/university filters.
- Return paginated result sets for universities/programs.
- Consider precomputed aggregates for common profile subject pairs.

Files:

- `apps/api/src/modules/admission/infrastructure/admission.repository.ts`
- `apps/api/src/modules/admission/admission.service.ts`

### 16. Avoid Recomputing Scores on Every Review

Current issue:
Review calls recalculate score and can rewrite answer correctness repeatedly.

Recommended implementation:

- Persist immutable score snapshots at finish time.
- Recalculate only when question/answer key changes.
- Add score versioning if content corrections are expected.

Files:

- `apps/api/src/modules/tests/test-session.service.ts`
- `apps/api/src/modules/tests/test-scorer.service.ts`

### 17. Strengthen Redis Lifecycle

Current issue:
Redis client lacks explicit shutdown, health handling, and offline queue policy.

Recommended implementation:

- Add `OnModuleDestroy` cleanup.
- Configure bounded retry/offline queue behavior.
- Add health endpoint checks for Redis-dependent flows.
- Fail fast for OTP/payment flows when Redis is unavailable.

Files:

- `apps/api/src/database/redis.module.ts`

## P2 Frontend and Platform Maintainability

### 18. Reconnect Landing Settings or Remove Dead Controls

Current issue:
Admin edits landing hero slides/settings, while current web landing appears hardcoded.

Recommended implementation:

- Decide if `/public/landing-settings` remains the source of truth.
- If yes, fetch settings in the current Next landing and hydrate hero/media/social links from API.
- If no, remove/deprecate admin controls to avoid false operational confidence.

Files:

- `apps/admin/src/pages/LandingSettingsPage.tsx`
- `apps/web/app/page.tsx`
- `apps/web/components/landing/hero.tsx`
- `apps/api/src/modules/settings/*`

### 19. Restrict Kaspi Setup to Admin/Ops

Current issue:
Kaspi setup appears in the user web dashboard with a manually entered shared secret.

Recommended implementation:

- Move setup UI to admin app.
- Require admin auth and server-side secret access.
- Do not ask operators to paste shared secrets into user-facing web pages.

Files:

- `apps/web/app/dashboard/kaspi-setup/page.tsx`
- `apps/admin/src/*`
- `apps/api/src/modules/billing/billing.controller.ts`

### 20. Clean API Proxy Error Handling

Current issue:
Next API proxy returns `String(err)` to the client on upstream failures.

Recommended implementation:

- Return generic user-safe errors.
- Log detailed upstream errors server-side only.
- Add request IDs for correlation.

Files:

- `apps/web/app/api/v1/[...path]/route.ts`

### 21. Fix SEO and Next Metadata Filenames

Current issue:
Hostnames drift between `my-test.kz` and `mytest.kz`; `robots.ts.ts` and `sitemap.ts.ts` are nonstandard filenames.

Recommended implementation:

- Set one canonical production domain.
- Rename files to `robots.ts` and `sitemap.ts`.
- Add tests or CI checks for canonical URLs.

Files:

- `apps/web/app/layout.tsx`
- `apps/web/app/sitemap.ts.ts`
- `apps/web/app/robots.ts.ts`

### 22. Stop Ignoring Web Type Errors in Production Builds

Current issue:
Next config ignores TypeScript build errors.

Recommended implementation:

- Fix current web type errors.
- Remove `typescript.ignoreBuildErrors`.
- Tighten `tsconfig` after migration stabilizes.

Files:

- `apps/web/next.config.mjs`
- `apps/web/tsconfig.json`

## Suggested Refactor Structure

### Payment Domain

Target shape:

- `BillingController`: request parsing only.
- `PaymentProviderVerifier`: provider-specific signature and payload validation.
- `PaymentOrderService`: provider-neutral order state machine.
- `SubscriptionActivationService`: creates/revokes subscriptions and entitlements.
- `PaymentAuditService`: durable audit records and analytics forwarding.

Core invariant:
No provider should directly create a subscription until an order has passed a guarded state transition from pending to paid with verified amount, currency, provider, and payment identity.

### Test Session Domain

Target shape:

- `QuestionSelectionService`: pure generation and validation.
- `AttemptReservationService`: entitlement decision and atomic usage ledger.
- `TestSessionWriter`: transactionally creates session, answers, and funnel/ledger links.
- `ScoreSnapshotService`: stores and versions final score state.

Core invariant:
A consumed paid/limited attempt must always point to a usable session or an explicit compensated/reversed ledger event.

### Auth Domain

Target shape:

- `CredentialAuthService`: email/password, Google, Telegram, OTP login.
- `SessionService`: refresh token rotation, revocation, reuse detection.
- `OtpService`: per-phone counters, lockouts, code creation/verification.
- `AuthorizationStateService`: channel/admin/premium checks based on trusted DB state.

Core invariant:
Long-lived authentication must be revocable, observable, and not solely stored in browser-accessible storage.

## Implementation Roadmap

### Phase 0: Production Risk Freeze, 1-2 days

- Require Kaspi webhook secret in production and fail closed.
- Add Kaspi amount/currency validation.
- Fix Vercel/Playwright web contract drift.
- Add `TestAnswer` duplicate detection query and migration plan.
- Document and monitor failed test starts after attempt consumption.

### Phase 1: Money and Attempts, 3-7 days

- Extract payment finalization state machine.
- Add payment idempotency tests across Kaspi/FreedomPay/Apple.
- Refactor test start to durable reservation/session flow.
- Add `@@unique([sessionId, questionId])` after cleanup.

### Phase 2: Auth and Abuse Controls, 1-2 weeks

- Introduce server-side refresh sessions.
- Move refresh token to httpOnly cookie or BFF session model.
- Add Redis-backed throttling and per-phone/email counters.
- Rework channel membership guard to read trusted state.

### Phase 3: Platform Alignment, 1 week

- Align docs, env examples, Vercel, and Playwright around Next.js.
- Reconnect landing settings or remove dead controls.
- Move Kaspi setup to admin/ops.
- Add app-level error and not-found boundaries.

### Phase 4: Scale and Maintainability, ongoing

- Optimize question selection.
- Cache admission chance queries.
- Persist score snapshots.
- Split large services by domain responsibility.
- Add production health checks for Postgres, Redis, payment dependencies, and Telegram bot integrations.

## Recommended CI Gates

- API:
  - `npx tsc -p apps/api/tsconfig.json --noEmit`
  - targeted Jest suites for billing/auth/access/session
  - Prisma migration safety check
- Web:
  - `npm --prefix apps/web run build`
  - Playwright against Next dev/preview server
  - no ignored TypeScript errors
- Admin:
  - `npm --prefix apps/admin run build`
  - upload/auth integration smoke tests
- Shared:
  - `npm --prefix packages/shared run build`
  - scoring/admission golden tests

## Definition of Done for "Production-Ready"

- Payment callbacks are authenticated, amount-verified, idempotent, and audited.
- Every consumed attempt has a session or a compensating ledger event.
- Refresh sessions are revocable and rotated.
- Browser token exposure is minimized.
- E2E tests run against the real deployed platform contract.
- Admin controls map to live product behavior.
- Core business rules live in one shared policy layer.
- High-cardinality reads are bounded, paginated, cached, or precomputed.
- Production-critical config fails startup when missing.

## Notes From This Review Run

- Multi-agent lanes:
  - backend/API/security/reliability;
  - business logic/data correctness;
  - frontend/platform maintainability.
- Existing untracked file `docs/architecture-review.md` was not modified.
- This document is a plan and review artifact. It does not replace the need for dedicated migrations, tests, and staged rollout for the P0/P1 changes.
