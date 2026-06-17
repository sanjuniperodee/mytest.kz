# Bilimland Deep Code Review & Optimization Plan

## 1. Executive Summary
A deep, 16-module parallel code review was executed. Adversarial verification cross-checked every critical and high-severity finding directly against the source code to eliminate false positives and hallucinations. This report focuses purely on deep architectural flaws, severe performance bottlenecks, race conditions, and business logic bugs. 

*(Note: Prior fixes such as the OTP vulnerability, async scrypt, and specific index drops have been omitted as they are already shipped.)*

## 2. Verified Critical Findings

### A. Reliability & Deadlocks
*   **Unhandled 3rd Party API Network Hangs Lead to Worker Deadlock** (Notifications)
    *   **File:** `apps/api/src/modules/telegram/telegram-bot.service.ts:561`
    *   **Issue:** `sendMessage` lacks a timeout. If the Telegram API hangs, the background worker deadlocks permanently because `this.running = true` is never cleared.
    *   **Fix:** Wrap `sendMessage` in a `Promise.race` timeout.
*   **Transaction Deadlock via Lock Ordering Inversion** (Subscriptions)
    *   **File:** `apps/api/src/modules/subscriptions/access.service.ts:237-240`
    *   **Issue:** `assertAndConsumeAttemptTx` and `updateUserTimezone` mutate the `User` and `UserExamEntitlement` tables in opposite sequences, guaranteeing a Postgres deadlock during concurrent requests.
    *   **Fix:** Standardize the lock acquisition sequence.
*   **Unhandled Transaction Failures / Entitlements De-sync** (Billing)
    *   **File:** `apps/api/src/modules/billing/billing.service.ts`
    *   **Issue:** Syncing entitlements occurs synchronously outside the checkout transaction. If it throws, the order is paid but the user gets no access.
    *   **Fix:** Refactor entitlement sync to accept a Prisma transaction client.

### B. Severe Performance Bottlenecks (OOMs & N+1 Queries)
*   **Memory Bloat on Question Exports** (Questions)
    *   **File:** `apps/api/src/modules/questions/questions.controller.ts:168`
    *   **Issue:** `exportQuestions` loads the entire DB table with relations into memory without pagination, crashing V8 (OOM) on large data sets.
    *   **Fix:** Implement cursor-based pagination with a streaming CSV writer (`csv-stringify`).
*   **N+1 Query Problem in Batch Imports** (Bulk Import)
    *   **File:** `apps/api/src/modules/bulk-import/bulk-import.service.ts:275`
    *   **Issue:** Uncached `prisma.topic.findUnique` runs inside a loop of thousands of questions, bypassing the bulk importer's cache.
    *   **Fix:** Add a `skipTopicCheck` flag for internal service callers or use `createMany`.
*   **Severe N+1 Query in Read Endpoint** (Subscriptions)
    *   **File:** `apps/api/src/modules/subscriptions/access.service.ts:256-283`
    *   **Issue:** `getUserAccessByExam` executes unconditional `upsert`/`updateMany` writes during reads, generating ~150+ queries per page load.
    *   **Fix:** Extract legacy syncing from the read path into an async job.
*   **Request Body Buffering Causes OOM Vulnerability** (Web Proxy)
    *   **File:** `apps/web/app/api/v1/[...path]/route.ts:34-36`
    *   **Issue:** API proxy buffers the entire request into memory via `await req.arrayBuffer()`, breaking `duplex: "half"` streaming.
    *   **Fix:** Stream directly via `init.body = req.body || undefined;`.
*   **Unindexed Full Table Scans in Analytics** (Analytics)
    *   **File:** `apps/api/src/modules/analytics/analytics.service.ts:551`
    *   **Issue:** Heavily filtered queries on `ts.status = 'completed'` lack a covering index.
    *   **Fix:** Add composite index `@@index([status, finishedAt])` on `TestSession`.
*   **Missing Caching for Dynamic Landing Settings** (Misc)
    *   **File:** `apps/api/src/modules/settings/settings.service.ts:37`
    *   **Issue:** `WhatsAppFab` unconditionally queries the DB on every mount of the dashboard for all users.
    *   **Fix:** Implement Redis caching with TTL.

### C. Data Integrity & State Machine Flaws
*   **Refresh Token Race Condition Causing Spontaneous Logouts** (Auth)
    *   **File:** `apps/api/src/modules/auth/auth.service.ts:384`
    *   **Issue:** Concurrent refresh requests bypass token checks, leading to a mismatched hash, tripping the security tripwire, and revoking all user sessions.
    *   **Fix:** Use atomic conditional `updateMany` for token rotation.
*   **Race Condition in Legacy Attempt Validation** (Subscriptions)
    *   **File:** `apps/api/src/modules/subscriptions/access.service.ts:568-580`
    *   **Issue:** `consumeLegacyAttemptTx` uses unlocked `.count()`, allowing concurrent requests to bypass trial limits.
    *   **Fix:** Lock a related row or forcefully migrate to V2 atomics.
*   **Queue Starvation / Deadlock Caused by In-Memory Deduplication** (Notifications)
    *   **File:** `apps/api/src/modules/notifications/notifications.service.ts:744-790`
    *   **Issue:** Failed notifications are continually queried by `findMany` but filtered out in-memory, causing infinite loops of empty batches.
    *   **Fix:** Shift deduplication logic into the Prisma DB query.
*   **OOM and PostgreSQL Parameter Limit Crash** (Users / Admin)
    *   **File:** `apps/api/src/modules/users/users.service.ts:745-774` and `admin-user.service.ts:155`
    *   **Issue:** Passing an array of thousands of `sessionIds` into an `in: [...]` clause exceeds PostgreSQL's bind parameter limit (65,535).
    *   **Fix:** Rely on native `ON DELETE CASCADE` configured in `schema.prisma`.

## 3. Verified High & Medium Findings

*   **Phantom Score Generation in ENT Scoring Logic** (Shared)
    *   **File:** `packages/shared/src/entQuestionScoring.ts:45`
    *   **Issue:** Returning `{ earned: 1, max: 0 }` for unweighted questions allows scores to exceed 100%.
    *   **Fix:** Early return 0 if `wMax <= 0`.
*   **ENT Validation Bypasses Grant Pass Threshold** (Shared)
    *   **File:** `packages/shared/src/entGrantModel.ts:51`
    *   **Issue:** `passesThresholds` omits the global 50-point minimum national check.
    *   **Fix:** Append `&& totalEntScore(s) >= 50` to the validation chain.
*   **Truncated Admission Data Silent Failure** (Admission)
    *   **File:** `apps/api/src/modules/admission/infrastructure/admission.repository.ts:82`
    *   **Issue:** Hardcoded `take: 15000` truncates admission chance datasets.
*   **Severe Re-render Performance Bottleneck** (Web UI)
    *   **File:** `apps/web/app/exam/[sessionId]/page.tsx:134`
    *   **Issue:** Root-level `setInterval` for the exam timer re-renders the entire 140-element question grid 4 times a second.
    *   **Fix:** Isolate the interval state inside a dedicated `<ExamTimer />` component.
*   **Silent Data Corruption in Answer Submission** (Web UI)
    *   **File:** `apps/web/app/exam/[sessionId]/page.tsx:290-312`
    *   **Issue:** Lacks `AbortController`, meaning an older pending fetch can overwrite a newer answer selection if it resolves later.
*   **Authentication Verification Lockout Circumvention** (Auth)
    *   **File:** `apps/api/src/modules/auth/auth.service.ts:238`
    *   **Issue:** `requestWebCode` unconditionally deletes the OTP lockout key, allowing attackers to bypass the 15-minute brute-force lockout.
*   **Aggressive Token Deletion on 5xx Errors** (Web Proxy)
    *   **Issue:** Network drops or 502 Bad Gateways unconditionally trigger `clearTokens()`, forcing user logouts instead of retrying.
*   **Race Condition in Checkout Cancellation** (Billing)
    *   **File:** `apps/api/src/modules/billing/billing.service.ts:811-822`
    *   **Issue:** Cancel order method blindly overwrites status without checking if it was just concurrently marked paid by a webhook.
*   **Amount Parsing Precision Logic Error** (Billing)
    *   **File:** `apps/api/src/modules/billing/billing.service.ts:39-40`
    *   **Issue:** `getNumber` utility incorrectly handles localized thousand separators, producing NaN and permanently rejecting valid payments.
*   **Read-Modify-Write JSON Anti-Pattern** (Billing)
    *   **File:** `apps/api/src/modules/billing/billing.service.ts:385-397`
    *   **Issue:** Concurrent webhook handlers manually fetch, mutate, and overwrite the JSON payload, causing data loss in payload history.

## 4. Prioritization & Next Steps

**Phase 1: Architecture Stability & OOM Prevention (Highest Priority)**
1. Refactor `exportQuestions` to use a stream pipeline to prevent V8 crashes.
2. Remove the `in: [...]` clause in user deletion flows to prevent Postgres crashes; rely on Cascades.
3. Add a timeout via `Promise.race` to Telegram `sendMessage` to prevent background worker deadlocks.
4. Convert Proxy buffer parsing to direct streaming (`init.body = req.body || undefined`).

**Phase 2: Correctness & Data Integrity**
1. Resolve the `updateUserTimezone` / `assertAndConsumeAttemptTx` lock inversion.
2. Fix the refresh token rotation race condition (`updateMany` with old hash).
3. Fix the `earnEntQuestionPoints` phantom scoring bug.
4. Update deduplication logic in Notifications to occur at the database query level.

**Phase 3: Client & API Performance**
1. Move the `setInterval` timer down the React tree in the Web UI.
2. Implement Redis caching in `SettingsService`.
3. Add an `AbortController` to the Web UI `submitAnswer` logic.
4. Add the missing compound index on `TestSession(status, finishedAt)`.
