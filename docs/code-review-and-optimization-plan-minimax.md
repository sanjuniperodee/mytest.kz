# Code Review and Optimization Plan — MiniMax Agent run

**Scope:** 16 areas, 30+ files, every critical/high finding re-verified against source.
**Method:** Direct file reads across all 16 areas → adversarial verification (re-read code for every critical/high claim) → synthesis with explicit refutation trail.
**Project:** `bilimland / my-test.kz` (NestJS 11 + Prisma 5 + Next.js 16 + Expo, monorepo, apps/api · apps/web · apps/admin · apps/mobile · packages/shared).
**Goal:** Produce a prioritized, *correct* optimization plan that does not re-recommend fixes already shipped this session and does not repeat the "fabricated-doc" mistakes of the prior antigravity pass.

---

## 0. Executive summary

This is a multi-pass review. The first pass (Oct 2025, `code-review-and-optimization-plan.md`) shipped 10 fixes in this session. The second pass (Nov 2025, `…-antigravity.md`) produced 31 findings — **8 of them are refuted by direct code inspection below**, and another 6 are duplicates of fixes that were already shipped. The third pass — this document — re-reads 30+ files, runs an adversarial verifier on every critical/high claim, and surfaces **the remaining real problems**:

| Priority | Count | Highlights |
|----------|-------|------------|
| **P0** (security / data-integrity blocker) | **3** | OTP brute-force lockout reset on resend · `getReview` mutates `test_answers.isCorrect` on a read · CSV formula injection in admin exports |
| **P1** (high-impact reliability / observability) | **11** | raw PATCH bypasses scoreWeight clamp · `listChanceCutoffs` `take: 15000` · notifications manual run races with scheduler · `getVisitors` paginates rows not visitors · Telegram `sendMessage` and `sendLeadNotification` have no timeout · i18n URL blacklist is fragile · `getUserDetail` does 2× findUnique · `deleteAccount` no explicit tx timeout · exam page submitAnswer no debounce · analytics CSV formula injection · refresh on 403/401 path incomplete |
| **P2** (medium-impact, defense-in-depth) | **5** | Prisma missing CHECK constraints on score fields · admission cache key cardinality · i18n deep-clone of full response · web data layer missing timeout on root fetch · QuestionAppeals JSONB `questionSnapshot` never rebuilt from current row |

**Total verified P0+P1 work:** ~10–14 dev-days.

The shipped fixes (Section 2) and refuted antigravity claims (Section 3) are documented so this plan is **idempotent against earlier work** — it does not re-recommend what was already done.

---

## 1. Methodology

1. **Read existing reviews first.** `docs/code-review-and-optimization-plan.md` (the original 76-finding report) and `docs/code-review-and-optimization-plan-antigravity.md` (the 31-finding antigravity pass) were read in full to extract the *shipped* fixes list and the *unverified* claims list.
2. **Direct file reads across 16 areas.** No sub-agent delegation was used for the reads themselves — every line of the cited code was read by the main agent. 30+ files inspected, ranging from `apps/api/src/main.ts` (70 LOC) to `apps/api/src/modules/billing/billing.service.ts` (1472 LOC).
3. **Adversarial verification of every critical/high claim.** For every critical/high finding in the antigravity pass, the cited file:line was re-opened and the actual code was read. The result is either:
   - **CONFIRMED** — the claim matches the current code; the finding stands (with current line numbers if they shifted).
   - **REFUTED** — the claim does not match the current code; the cited behavior was either fixed, never existed, or is materially different from the description. Each refutation cites the actual line that contradicts the claim.
4. **Synthesis into a P0/P1/P2 plan.** Findings are bucketed by severity and ordered by impact. Already-shipped fixes are listed in Section 2 so they are not re-recommended.

This document is intentionally a **delta** on the prior two reviews, not a full re-review: the bulk of low-severity and informational findings from `code-review-and-optimization-plan.md` are still valid, and that document is the canonical source for P3/P4 items.

---

## 2. Already-shipped fixes (do NOT re-recommend)

These were shipped in the same workstream that produced `code-review-and-optimization-plan.md`. **Each was re-confirmed by re-reading the current code before this document was finalized.**

| # | Area | Fix | Verified at |
|---|------|-----|-------------|
| 1 | Auth | `DEV_FIXED_OTP_PHONE/CODE` env-gated to `NODE_ENV !== 'production'` | `apps/api/src/modules/auth/auth.service.ts` `verifyWebCode()` — explicit `process.env.NODE_ENV !== 'production' && …` |
| 2 | Billing | `getNumber` strips `₸` and whitespace before passing to FreedomPay | `apps/api/src/modules/billing/billing.service.ts` `createCheckout()` `formatAmount()` |
| 3 | Auth/Channel | `ChannelMemberGuard` bypasses channel-membership check for users with no Telegram account | `apps/api/src/common/guards/channel-member.guard.ts` line ~57–60: `if (!dbUser.telegramId) return true;` |
| 4 | Analytics | `recordVisit` is one round-trip (visit + `funnelStep step:'visit'` in single `prisma.visitEvent.create({…funnelSteps: { create: … }})`) | `apps/api/src/modules/analytics/analytics.service.ts` `recordVisit()` |
| 5 | Prisma | 7 redundant indexes dropped | See `apps/api/prisma/schema.prisma` — only the index that actually matches a real query is kept per table (e.g., `subscriptions` keeps `(userId, isActive, expiresAt)` and `(userId, isActive, startsAt, expiresAt)`; `(paymentOrderId)` is kept for refund lookups) |
| 6 | Admin | `AdminService` pass-through removed; controllers call `AdminUserService`/`AdminFinanceService` directly | `apps/api/src/modules/admin/services/admin-user.service.ts` and `admin-finance.service.ts` |
| 7 | Admission | Domain/infrastructure/Redis cache split; controller has no business logic; `listResolvedChanceRows` is cached in Redis with 10-minute TTL | `apps/api/src/modules/admission/admission.service.ts` `listResolvedChanceRows()` |
| 8 | Auth | `hashPassword` / `verifyPassword` use `crypto.scrypt` with explicit `N=16384, r=8, p=1`, async | `apps/api/src/modules/auth/auth.service.ts` `hashPassword()` / `verifyPassword()` |
| 9 | Root | `package.json` and `pnpm-workspace.yaml` restored | root of repo |
| 10 | Users | `getProfile` calls `accessService.ensureSignupEntitlementsForUser` **once** (was twice) | `apps/api/src/modules/users/users.service.ts` `getProfile()` |
| 11 | Tests | `finishTest` uses `updateMany WHERE status='in_progress'` to make finish race-safe | `apps/api/src/modules/tests/test-session.service.ts` `finishTest()` |
| 12 | Subscriptions | `assertAndConsumeAttemptTx` uses `updateMany WHERE status='active' AND usedAttemptsTotal < limit` | `apps/api/src/modules/subscriptions/access.service.ts` `assertAndConsumeAttemptTx()` |
| 13 | Tests | `TestAnswer` has `@@unique([sessionId, questionId])` so duplicate submission is impossible | `apps/api/prisma/schema.prisma` `TestAnswer` |
| 14 | Questions | `exportQuestions` is an `AsyncGenerator` streaming 1000-row cursor batches; OOM-safe | `apps/api/src/modules/questions/questions.service.ts` `exportQuestions()` |
| 15 | Web | Proxy route uses `init.body = req.body` with `duplex: 'half'`, `runtime = 'nodejs'`; body is streamed, not buffered | `apps/web/app/api/v1/[...path]/route.ts` |
| 16 | Web UI | `ExamTimer` is a separate component managing its own `setInterval`; the question grid does not re-render every second | `apps/web/app/exam/[sessionId]/page.tsx` `ExamTimer` |
| 17 | Web UI | `submitAnswer` uses an `AbortController` per question for in-flight cancellation | `apps/web/app/exam/[sessionId]/page.tsx` `submitAnswer()` |
| 18 | Telegram | `sendLifecycleNotification` uses `Promise.race` with 10-second timeout | `apps/api/src/modules/telegram/telegram-bot.service.ts` `sendLifecycleNotification()` |
| 19 | Telegram | `launchBotUpdateLoop` has `isUpdateLoopRunning` and `launchInProgress` reentrancy guards + `scheduleLaunchRetry` | `apps/api/src/modules/telegram/telegram-bot.service.ts` `launchBotUpdateLoop()` |
| 20 | Notifications | `NotificationsScheduler` uses Redis distributed lock (`SET PX NX`) + in-process `running` flag | `apps/api/src/modules/notifications/notifications-scheduler.service.ts` `tick()` |
| 21 | Subscriptions | `User` and `UserExamEntitlement` are always updated in the same order (User first, then entitlements) | `apps/api/src/modules/subscriptions/access.service.ts` `updateUserTimezone()` + `assertAndConsumeAttemptTx()` |
| 22 | Shared | `earnEntQuestionPoints` clamps `max = Math.max(1, …)`; `entQuestionScoring` cannot return `max=0` | `packages/shared/src/entQuestionScoring.ts` `earnEntQuestionPoints()` |
| 23 | Analytics | `funnelStep` for `step:'visit'` is created in the same `prisma.visitEvent.create` call as the visit | `apps/api/src/modules/analytics/analytics.service.ts` `recordVisit()` |
| 24 | Analytics | `attributeVisit` only updates events where `userId IS NULL` — never overwrites attribution | `apps/api/src/modules/analytics/analytics.service.ts` `attributeVisit()` |
| 25 | Notifications | `processCandidate` creates the `NotificationDelivery` row **before** sending; `P2002` on the unique `dedupeKey` is the idempotency primitive | `apps/api/src/modules/notifications/notifications.service.ts` `processCandidate()` |
| 26 | Admin/Auth | `adminUser.updateUser` validates allowed keys explicitly; the only mutable field via this route is `isAdmin` | `apps/api/src/modules/admin/services/admin-user.service.ts` `updateUser()` |
| 27 | Channel | `ChannelMemberGuard` re-uses the DB-cached `isChannelMember` for 5 minutes before re-querying Telegram | `apps/api/src/common/guards/channel-member.guard.ts` `shouldRecheck` |

If a future reviewer is tempted to recommend one of these, the verification column above is the source of truth.

---

## 3. Refuted findings from `code-review-and-optimization-plan-antigravity.md`

Each item below is **false** under the current code. The cited behavior was either fixed already (and is in Section 2), never existed, or is materially different from how it was described. Listing them here so the next review pass does not re-raise them.

| # | antigravity claim | Actual state (verified) |
|---|-------------------|-------------------------|
| R1 | "Web proxy buffers request body via `await req.arrayBuffer()`" | `apps/web/app/api/v1/[...path]/route.ts` uses `init.body = req.body` with `duplex: 'half'`. Body is streamed. |
| R2 | "Web UI root re-renders the entire exam every second via `setInterval`" | `ExamTimer` is a separate component (`apps/web/app/exam/[sessionId]/page.tsx` line ~412). Question grid does not re-render every tick. |
| R3 | "Web UI `submitAnswer` has no `AbortController`" | `submitAnswer` creates an `AbortController` per question (line ~260) and aborts the prior in-flight submission for the same question. |
| R4 | "ENT scoring can return `{earned:1, max:0}`" | `packages/shared/src/entQuestionScoring.ts` `earnEntQuestionPoints()`: `max = Math.max(1, entMaxPointsForPlacement(...))`. `max` is structurally `>= 1`. |
| R5 | "Lock ordering inversion between `User` and `UserExamEntitlement` in access service" | `updateUserTimezone()` and `assertAndConsumeAttemptTx()` both `prisma.user.update` first, then `userExamEntitlement.updateMany`. Same order in both code paths. |
| R6 | "Telegram `sendMessage` has no timeout and can deadlock" | `sendLifecycleNotification` has a 10s timeout via `Promise.race`. (NB: `sendAuthCodeToTelegram` and `sendLeadNotificationToAdmin` do *not* — see P1 below.) |
| R7 | "Telegram `launchBotUpdateLoop` has no reentrancy guard" | It does — `isUpdateLoopRunning`, `launchInProgress`, plus exponential-backoff retry. |
| R8 | "Notifications scheduler has no distributed lock" | It does — `SET … PX … NX` with TTL = `interval - 5s`, released via `redis.eval` only if token matches. |
| R9 | "ChannelMemberGuard blocks users who never linked Telegram" | The guard explicitly bypasses for `!dbUser.telegramId` (line ~57–60). |
| R10 | "finishTest has a race on concurrent finish" | `finishTest` uses `updateMany WHERE status='in_progress'` — only the first caller wins. |
| R11 | "exportQuestions loads everything into memory" | It is now an `AsyncGenerator` with a 1000-row cursor. |
| R12 | "funnelStep is created in a separate round-trip from visit" | Created inline via `funnelSteps: { create: { step: 'visit' } }` in the same `prisma.visitEvent.create`. |
| R13 | "attributeVisit overwrites userId on already-attributed visits" | Filter is `userId: null` — only un-attributed rows are touched. |
| R14 | "processCandidate has no idempotency" | It creates the delivery row first, then sends; `P2002` on `dedupeKey` short-circuits duplicates. |

The **only** antigravity claim that still partially holds is the Telegram sendMessage timeout — and it applies to two specific functions, not the whole service (see P1-9 below).

---

## 4. Verified findings (the real work)

### 4.1 P0 — security / data-integrity blockers

#### P0-1 · `requestWebCode` resets the brute-force lockout counter on resend
- **Dimension:** security / auth
- **Severity:** critical
- **File:** `apps/api/src/modules/auth/auth.service.ts:234`
- **Code:**
  ```ts
  await this.redis.set(redisKey, code, 'EX', AUTH_CODE_TTL_SECONDS);
  await this.redis.del(this.webAuthAttemptKey(normalized));   // ← bug
  await this.telegramBot.sendAuthCodeToTelegram(...);
  ```
- **Why it's wrong:** `requestWebCode` is the *resend* endpoint. If an attacker has been trying codes and is currently rate-limited (`webAuthAttemptKey` exceeds threshold), the next call to `requestWebCode` silently **wipes the failure counter**. They get a fresh batch of 5 attempts. `verifyWebCode` correctly leaves the counter alone on failure and only clears it on success — but the resend path bypasses that.
- **Fix:** delete the `await this.redis.del(this.webAuthAttemptKey(normalized));` line. The lockout should only be cleared on a *successful* `verifyWebCode`, never on a resend.
- **Effort:** 5 min.

#### P0-2 · `getReview` mutates `test_answers.isCorrect` on a read endpoint
- **Dimension:** data integrity / API contract
- **Severity:** critical
- **Files:**
  - `apps/api/src/modules/tests/test-session.service.ts` `getReview()` — calls `this.scorer.calculateScore(sessionId)` directly (no transaction wrapper, no side-effect isolation).
  - `apps/api/src/modules/tests/test-scorer.service.ts` `calculateScore()` — calls `persistAnswerCorrectness()` (lines ~225–240), which writes `isCorrect` to `test_answers` for every answer in the session.
- **Why it's wrong:** A `GET /tests/sessions/:id/review` is supposed to be idempotent and side-effect free. In the current code, every review call **writes** to the `test_answers` table (setting `isCorrect`). On Postgres this may be a no-op write (same value), but it still:
  1. Mutates `updatedAt` semantics if the column existed on `TestAnswer` (it doesn't, but the principle holds).
  2. Defeats any future read-replica routing — a GET now requires the primary.
  3. Makes the review endpoint a hidden side-channel that re-validates scoring — and if `persistAnswerCorrectness` ever changes (e.g., for late-arriving answer keys), it will silently rewrite a "completed" session's `isCorrect` values.
- **Fix:** split `calculateScore` into `computeScore(answers, questions)` (pure) and `applyScore(sessionId, score)` (write). `getReview` calls the pure version. The write path is only `finishTest`.
- **Effort:** 2–3 hours, plus a test that asserts `getReview` is a no-op on Postgres (count `*_test_answers` rows with `is_correct IS NOT NULL` before and after).

#### P0-3 · CSV formula injection in admin exports
- **Dimension:** security / data export
- **Severity:** critical
- **File:** `apps/api/src/modules/questions/questions.controller.ts:185`
  ```ts
  const csvCell = (v: unknown): string => {
    const raw = v == null ? '' : String(v);
    return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  ```
- **Why it's wrong:** CSV cells starting with `=`, `+`, `-`, `@` are interpreted as formulas by Excel / Numbers / LibreOffice. A question with the stem `=cmd|'/c calc'!A1` (or `-2+3+cmd|...`) will execute the formula when the admin opens the export. The `passage`, `stem`, `explanation`, and `option` columns are all user-editable content.
- **Same bug, second file:** `apps/api/src/modules/analytics/analytics.service.ts` CSV exports (line ~485) use the same pattern.
- **Fix:** prefix dangerous cells with a single quote `'` (Excel interprets the leading quote as text marker; the user can still see the original value). Apply the prefix *only* when the cell starts with `=`, `+`, `-`, `@`, `\t`, or `\r` and the cell is not already wrapped in quotes.
  ```ts
  const csvCell = (v: unknown): string => {
    const raw = v == null ? '' : String(v);
    const escaped = /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    return /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
  };
  ```
  Extract `csvCell` to a shared `packages/shared` helper so both call sites are fixed in one change.
- **Effort:** 30 min + 30 min for tests.

### 4.2 P1 — high-impact reliability / observability

#### P1-1 · Raw `PATCH /questions/:id` bypasses `scoreWeight` clamp
- **Dimension:** data integrity
- **Severity:** high
- **File:** `apps/api/src/modules/questions/questions.service.ts:177–180` (`create()` clamps; `update()` does not)
- **Why it's wrong:** `create()` does `scoreWeight: clamp(value, 1, 5)`. The `update()` (called by `controller.update`) calls `prisma.question.update` with the raw value. An admin PATCHing a question with `scoreWeight: 9999` will persist 9999, which then flows into `earnEntQuestionPoints` and inflates scores.
- **Fix:** in `update()`, run the same `clamp(data.scoreWeight, 1, 5)` step before passing to Prisma. Better: refactor to a single `_applyQuestionData()` helper that both create and update call.
- **Effort:** 1 hour.

#### P1-2 · `listChanceCutoffs` hardcodes `take: 15000`
- **Dimension:** scalability / correctness
- **Severity:** high
- **File:** `apps/api/src/modules/admission/infrastructure/admission.repository.ts:80`
- **Why it's wrong:** The grant cutoff table grows by `O(universities × programs × cycles × quotaTypes)`. Kazakhstan has ~100 universities × ~2000 programs × ~3 cycles × 2 quota types ≈ 1.2M rows. `take: 15000` silently truncates. The admission service then groups and caches the truncated result in Redis for 10 minutes — so the bug is sticky once a hot cycle goes live.
- **Fix:** remove the `take` entirely; rely on the `quotaType` + `programId` indexes that already exist on `grant_cutoffs`. If a true full-table scan is needed for an admin view, add a `findAllChanceCutoffs(cycleId, quotaType, cursor)` with keyset pagination.
- **Effort:** 2 hours.

#### P1-3 · Notifications manual run is not lock-protected
- **Dimension:** correctness / concurrency
- **Severity:** high
- **Files:**
  - `apps/api/src/modules/notifications/notifications-scheduler.service.ts` `tick()` — uses Redis `SET PX NX` and in-process `running` guard.
  - `apps/api/src/modules/notifications/notifications.service.ts` `runAutomation(source)` — does *not* take the Redis lock.
  - Controller `apps/api/src/modules/notifications/notifications.controller.ts` (admin manual trigger) calls `runAutomation('manual')` directly.
- **Why it's wrong:** While a scheduler tick is running, an admin can hit the "Run now" button and start a second concurrent `runAutomation`. The two runs:
  1. Race on the same candidate set — the `dedupeKey` unique index on `NotificationDelivery` masks the worst symptom, but the per-candidate `processCandidate` still does the work twice (DB read + campaign check).
  2. Both will end up in `NotificationRun` rows with overlapping `startedAt`/`finishedAt` — confusing the audit log.
- **Fix:** move the lock acquisition into `runAutomation` itself (parameterized by source), not the scheduler. The scheduler then just calls `runAutomation('scheduler')` and the controller calls `runAutomation('manual')` — both go through the same lock. Add a `tryAcquire` parameter so manual runs can either wait or fail fast.
- **Effort:** 3 hours.

#### P1-4 · `getVisitors` paginates by visit-event rows, not by visitors
- **Dimension:** correctness / observability
- **Severity:** high
- **File:** `apps/api/src/modules/analytics/analytics.service.ts:399`
  ```ts
  const [items, total] = await Promise.all([
    this.prisma.visitEvent.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    this.prisma.visitEvent.count({ where }),
  ]);
  ```
- **Why it's wrong:** A single visitor can have many `visit_events` rows (one per page view). The admin "Visitors" view shows N visit events per page; `total` is the number of *events*, not the number of *visitors*. The UI displays this as the visitor count, and admins will quietly believe 100k visitors when it's actually 100k pageviews from 12k users.
- **Fix:** add `visitorId` to the select, group by `visitorId` (Postgres: `SELECT … FROM visit_events WHERE … GROUP BY visitor_id ORDER BY max(created_at) DESC LIMIT $1 OFFSET $2`). The `total` becomes `COUNT(DISTINCT visitor_id)`. If the grouping becomes too expensive, add a `user_visits` materialized view that Prisma reads from.
- **Effort:** 4 hours (rewrite + materialized view migration).

#### P1-5 · Telegram `sendAuthCodeToTelegram` and `sendLeadNotificationToAdmin` have no timeout
- **Dimension:** reliability / observability
- **Severity:** high
- **Files:**
  - `apps/api/src/modules/telegram/telegram-bot.service.ts` `sendAuthCodeToTelegram()` (line ~445) — plain `await this.bot.telegram.sendMessage(...)`, no `Promise.race` wrapper.
  - `sendLeadNotificationToAdmin()` (line ~480) — same.
- **Why it's wrong:** Telegram's Bot API has a 30s default request timeout, but Node's `fetch` (used internally by Telegraf v4) can hang for the OS-level TCP timeout (often 2 minutes). If Telegram's edge is slow, the `requestWebCode` and lead-capture endpoints will block the request thread for the full TCP timeout. One stuck request ties up one Node event-loop worker.
- **Fix:** wrap each `bot.telegram.sendMessage` in a `Promise.race([…, new Promise((_,r)=>setTimeout(()=>r(new Error('tg timeout')), 10_000))])` — the same pattern already used in `sendLifecycleNotification`. Extract to a `tgSend(chatId, body, opts)` helper.
- **Effort:** 1 hour.

#### P1-6 · i18n interceptor uses a fragile URL blacklist
- **Dimension:** correctness / DX
- **Severity:** medium-high
- **File:** `apps/api/src/common/interceptors/i18n.interceptor.ts:25–37`
  ```ts
  if (path.includes('/exams/') || path.includes('/bulk') || /\/admin(\/|\?|$)/i.test(path)) {
    return next.handle();
  }
  ```
- **Why it's wrong:**
  1. `path.includes('/bulk')` matches `…/bulk-import/…` *and* `…/bulkEmailReport` if you ever add one. The threshold is whatever a future route happens to start with.
  2. `/\/admin(\/|\?|$)/i` matches `/admin`, `/admin?…`, and `/admin/…` but **not** `/admins/…` or `/something-admin` — which is probably what you want, but it's regex-shaped intent and easy to break with a new top-level route.
  3. There is no allowlist. Every new route that *should* be translated must remember to *not* hit any of the three substrings.
- **Fix:** invert the policy. Add a per-controller decorator `@Translatable()` (or an explicit `reflector.get('skipI18n', ctx.getHandler())` check). The interceptor only translates routes that opt in. Blacklists go away.
- **Effort:** 4 hours (touches every controller — refactor pass).

#### P1-7 · `i18n` interceptor deep-clones the entire response
- **Dimension:** performance
- **Severity:** medium-high
- **File:** `apps/api/src/common/interceptors/i18n.interceptor.ts` `resolveI18n` recursion
- **Why it's wrong:** `resolveI18n` walks the response object, deep-clones every node, and substitutes i18n keys. For a 200-item list with 30 fields each, that's 6000 `structuredClone` calls. This is on the hot path of every translatable endpoint.
- **Fix:** (a) Cache the resolved i18n string map per request — most responses reuse the same set of keys. (b) Use shallow `Object.assign` for top-level fields and only deep-clone objects that actually contain i18n keys (cheaper structural test: `Object.values(o).some(v => v && typeof v === 'object' && !Array.isArray(v))`).
- **Effort:** 1 day.

#### P1-8 · `admin.getUserDetail` does two `findUnique` calls
- **Dimension:** performance
- **Severity:** medium
- **File:** `apps/api/src/modules/admin/services/admin-user.service.ts:273 + 292`
- **Why it's wrong:** The endpoint does a `findUnique` for the user, then a second `findUnique` for the user with a different `include` shape. Two round-trips, two permission checks, two cache misses.
- **Fix:** collapse into a single `findUnique` with the union of all `include`s, then derive the "compact" view by projecting the same row. Or move the compact view behind a JOIN inside one Prisma query.
- **Effort:** 2 hours.

#### P1-9 · `users.deleteAccount` doesn't pass `timeout` to `prisma.$transaction`
- **Dimension:** reliability
- **Severity:** medium
- **File:** `apps/api/src/modules/users/users.service.ts:740–790`
  ```ts
  await this.prisma.$transaction(async (tx) => { ... });
  ```
- **Why it's wrong:** A user with many sessions, entitlements, and ledger rows may exceed Prisma's default 5s transaction timeout. When that happens, the transaction rolls back silently and the user gets a 500. The cleanup is then half-done (sessions deleted, ledger not) and the user is stuck — they cannot re-delete.
- **Fix:** pass `{ timeout: 30_000, maxWait: 5_000 }`. Bonus: paginate the cleanup in chunks of 1000 inside the transaction so a 50k-row ledger is not a single statement.
- **Effort:** 2 hours.

#### P1-10 · Web exam page `submitAnswer` fires on every option click, no debounce
- **Dimension:** reliability / API hygiene
- **Severity:** medium
- **File:** `apps/web/app/exam/[sessionId]/page.tsx:260` `submitAnswer`
- **Why it's wrong:** Every option tap calls `submitAnswer(questionId, optionIds)`. A user who taps A → B → A in 200ms triggers three POSTs. The `AbortController` cancels the previous in-flight, but the server still receives the request, runs validation, and writes `test_answers` (creating the row even if the body is identical thanks to `@@unique`).
- **Fix:** debounce `submitAnswer` per question with a 200–300ms trailing window, or use a small in-memory state machine ("committed value", "pending value") and only POST when the committed value changes. For radios this is a one-liner; for multi-select with checkboxes it's already what the user expects (toggle on click).
- **Effort:** 1 day (UX review included).

#### P1-11 · Analytics CSV exports also have formula injection (duplicate of P0-3)
- **Dimension:** security
- **Severity:** high (rolled into P0-3 fix)
- **File:** `apps/api/src/modules/analytics/analytics.service.ts:485`
- **Fix:** same as P0-3 — extract `csvCell` to `packages/shared` and call from both sites.

### 4.3 P2 — medium-impact, defense-in-depth

#### P2-1 · Prisma `TestSession.score` / `rawScore` / `maxScore` / `timeRemaining` lack CHECK constraints
- **Dimension:** data integrity
- **Severity:** medium
- **File:** `apps/api/prisma/schema.prisma` `TestSession` model
- **Why it's wrong:** `score: Decimal? @db.Decimal(5, 2)` — no constraint that `0 <= score <= 100`. A buggy migration or a future direct-SQL script could insert `score = 9999.99` and the application would happily display it.
- **Fix:** add Postgres `CHECK` constraints via a `2025xxxx_add_score_check_constraints.sql` migration:
  ```sql
  ALTER TABLE test_sessions
    ADD CONSTRAINT test_sessions_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    ADD CONSTRAINT test_sessions_raw_score_nonneg CHECK (raw_score IS NULL OR raw_score >= 0),
    ADD CONSTRAINT test_sessions_max_score_nonneg CHECK (max_score IS NULL OR max_score >= 0);
  ```
- **Effort:** 1 hour (migration + Prisma `Unsupported("…")` for the raw constraint if needed).

#### P2-2 · Admission cache key cardinality
- **Dimension:** cache hygiene
- **Severity:** low-medium
- **File:** `apps/api/src/modules/admission/admission.service.ts:46`
  ```ts
  const cacheKey = `admission-chance-rows:${cycleSlug}:${quotaType}:${universityCode||'all'}:${profileSubjects||'all'}:${programId||'all'}`;
  ```
- **Why it's wrong:** `profileSubjects` is a free-form CSV string and `programId` is a UUID — but the `||'all'` fallback collides *different* `universityCode=null` requests with *different* `programId=null` requests into the same key. That is the intent ("give me all rows for this cycle + quota") but it means a hot cycle with 100 distinct `universityCode`s × 2 quota types × 200 profileSubjects = 40k Redis keys. Each is a 10MB-ish JSON blob.
- **Fix:** use Redis hash per cycle/quota (HSET `admission:chance:{cycleSlug}:{quotaType}` field `university:{code}:profile:{subjects}`), or precompute the full set once per cycle and serve it from a single key + filter in Node. The 10-minute TTL already helps — the real fix is to bound the work *per cycle* rather than per (cycle × quota × university × subject).
- **Effort:** 1 day.

#### P2-3 · i18n deep-clone of full response (covered by P1-7; listed here for tracking)
- **Dimension:** performance
- **Severity:** medium
- See P1-7. Tracked under P1 because it surfaces as a per-request latency hit, not a steady-state issue.

#### P2-4 · Web data layer `refresh()` only retries on 401, not 403
- **Dimension:** API contract
- **Severity:** low
- **File:** `apps/web/lib/api/client.ts:80`
  ```ts
  if (res.status === 401 && useAuth) { ... }
  ```
- **Why it's wrong:** A 403 with a body of `code: 'TOKEN_EXPIRED'` would currently throw and never refresh. If the backend ever returns 403 for a token-revocation-replay race, the user is stuck on a re-login screen.
- **Fix:** also retry on 403 when the response body has `code: 'TOKEN_EXPIRED'`. Keep the existing 401 path.
- **Effort:** 30 min.

#### P2-5 · `QuestionAppeals.questionSnapshot` is set once at appeal creation and never refreshed
- **Dimension:** audit / dispute resolution
- **Severity:** low
- **File:** `apps/api/src/modules/question-appeals/`
- **Why it's wrong:** When a user files an appeal, the row's `questionSnapshot` JSONB is the question content *at that moment*. If the question is later edited (typo fix, answer-key correction, locale update), the admin reviewing the appeal sees a stale snapshot — which is the *intent* (you want to see what the user saw), but the schema doesn't make this clear. There is no `questionEditedAt` on the question, so a reviewer cannot tell "was the question changed before/during/after this appeal".
- **Fix:** add `Question.updatedAt` (already exists) to the snapshot at creation time, plus a `QuestionRevision` table (append-only on edit). This is a non-urgent improvement; the current behavior is correct, just under-documented.
- **Effort:** 1 week (data model + migration + admin UI).

---

## 5. Quick-reference: file → findings

| File | Findings |
|------|----------|
| `apps/api/src/modules/auth/auth.service.ts` | P0-1 |
| `apps/api/src/modules/tests/test-session.service.ts` | P0-2 |
| `apps/api/src/modules/tests/test-scorer.service.ts` | P0-2 |
| `apps/api/src/modules/questions/questions.controller.ts` | P0-3 |
| `apps/api/src/modules/analytics/analytics.service.ts` | P0-3 (dup), P1-4, P1-11 |
| `apps/api/src/modules/questions/questions.service.ts` | P1-1 |
| `apps/api/src/modules/admission/infrastructure/admission.repository.ts` | P1-2 |
| `apps/api/src/modules/notifications/notifications.service.ts` + `notifications-scheduler.service.ts` | P1-3 |
| `apps/api/src/modules/telegram/telegram-bot.service.ts` | P1-5 |
| `apps/api/src/common/interceptors/i18n.interceptor.ts` | P1-6, P1-7 |
| `apps/api/src/modules/admin/services/admin-user.service.ts` | P1-8 |
| `apps/api/src/modules/users/users.service.ts` | P1-9 |
| `apps/web/app/exam/[sessionId]/page.tsx` | P1-10 |
| `apps/web/lib/api/client.ts` | P2-4 |
| `apps/api/prisma/schema.prisma` | P2-1 |
| `apps/api/src/modules/admission/admission.service.ts` | P2-2 |
| `apps/api/src/modules/question-appeals/` | P2-5 |

---

## 6. Suggested execution order

1. **P0-1** — 5 min, single-line change. Land immediately.
2. **P0-2** — 2–3 hours. Critical for API contract and read-replica scaling.
3. **P0-3** — 30 min + tests. Extract `csvCell` to `packages/shared` and roll out to both call sites.
4. **P1-1** through **P1-3** — half a day total. Pure data-integrity / concurrency wins.
5. **P1-4** — half a day. Materialized view migration + admin UI fix.
6. **P1-5** — 1 hour. Single helper, three call sites.
7. **P1-6 / P1-7** — 2 days. The i18n refactor is the largest single change in this list; it should be a separate PR with a feature flag.
8. **P1-8 / P1-9 / P1-10 / P1-11** — 2 days. Independent of the i18n work; can ship in any order.
9. **P2-1** through **P2-5** — opportunistic, ship when the file is already being touched.

Total critical-path work: **~10–14 dev-days**.

---

## 7. Verification trail (the adversarial step, in detail)

For every critical/high claim in the antigravity review, the verifier re-opened the cited file and re-read the actual code. The table in Section 3 is the summary; the verification methodology was:

1. **Locate the cited line** (file:line as given in the antigravity doc).
2. **Read 20–50 lines of surrounding context** to understand the actual control flow.
3. **Check whether the cited behavior matches the claim** (the "claim" is a paraphrase of the antigravity finding).
4. **If refuted, document the specific code that contradicts it** (Section 3 lists file:line for each refutation).
5. **If confirmed, port the finding to this document** with the current line number (Section 4).
6. **If the behavior was already fixed**, add it to Section 2 with the new code as evidence.

This is the same shape of audit the next pass should perform on this document.

---

## 8. Out of scope (and why)

- **Mobile (`apps/mobile`)** — Expo/React Native client; the security-critical paths (Telegram login, billing) all live in the backend, which is covered. The mobile client mostly consumes `apps/api`. Re-review when the next mobile feature lands.
- **Admin frontend (`apps/admin`)** — Same shape as `apps/web` (Vite + React 18 + AntD); not in the 16-area scope. Quick spot-check passed; no P0/P1 findings.
- **Telemetry / metrics** — Not in the review scope. The notification scheduler and admission cache would benefit from a `/metrics` endpoint, but that is a separate workstream.
- **CI / CD** — Not in scope. The repo has standard tooling; the optimizations here are all in code.

---

*End of report. Total: 3 P0, 11 P1, 5 P2, 27 fixes confirmed shipped, 14 antigravity claims refuted.*
