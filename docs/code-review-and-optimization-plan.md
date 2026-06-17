# Code Review & Optimization Plan — Bilimland / my-test.kz

> **How this was produced.** A multi-agent review fanned out one senior reviewer per area; every critical/high finding was queued for adversarial verification. It ran in two passes covering **all 16 areas → 139 findings**.
> - **Part 1** (auth, billing, tests, questions/bulk-import, analytics, notifications, users, admin): **76 findings (16 high / 32 medium / 28 low)**. Verifiers were cut short by the usage limit, so these are reviewer-asserted with file:line — spot-check the higher-risk ones (esp. the FreedomPay billing items) before acting.
> - **Part 2** (subscriptions/access, admission, misc-modules, common/bootstrap, web-data, web-ui, shared, data-layer): **63 findings**, and here the **adversarial verifiers did run** — they confirmed each high/critical and **downgraded most reviewer "high"s** after reading the code (corrections noted inline). The one finding that survived as genuinely **HIGH** is *tokens in `localStorage`*.

---

## Architecture at a glance

- **API** (`apps/api`, NestJS 11, prefix `/api/v1`): ~18 modules → Prisma 5 / Postgres 16, Redis (ioredis), Telegraf bot, FreedomPay + Kaspi + Apple IAP billing. Global `ValidationPipe` (whitelist+transform), `I18nInterceptor`, per-route `ThrottlerGuard`.
- **Web** (`apps/web`, Next.js 16 App Router, React 19): same-origin proxy `app/api/v1/[...path]` → API; SWR data layer in `lib/api/`.
- **Admin** (`apps/admin`, Vite + React 18 + AntD), **Mobile** (`apps/mobile`, Expo), **Shared** (`packages/shared`, ENT scoring/validators).
- **Reference pattern:** the `admission` module (pure `domain/` + isolated `infrastructure/` repository + thin orchestrator service) is the target shape every mega-service below should move toward.

## What was already fixed & deployed this session

- 🔒 OTP backdoor → env-gated (`DEV_FIXED_OTP_PHONE/CODE`, non-prod only)
- 💸 Kaspi `getNumber` strips `₸` → fixed `AMOUNT_MISMATCH` stuck-`pending`
- 🚪 `ChannelMemberGuard` now bypasses non-Telegram (Google/email) users
- ⚡ `recordVisit` → one round-trip; 7 redundant DB indexes dropped (migration applied)
- 🧹 `AdminService` pass-through removed; admission → `domain/`+`infrastructure/`+Redis cache
- 🔑 password hashing → async `scrypt` + explicit N/r/p; `attrributeVisit`→`attributeVisit`
- 🏗 root `package.json`/workspaces restored; prod hardening (4 GB swap, ufw, pm2-logrotate)

---

## Code review findings

### 🔐 Security

**HIGH**
1. **Mass-assignment on `PATCH /admin/users/:id`** — `admin-users.controller.ts:32` / `admin-user.service.ts:131`. `@Body()` is an inline TS type, so `ValidationPipe` doesn't strip it; the raw body flows into `prisma.user.update`. An admin can set **any** column (`email`, `passwordHash`, `emailVerified`, `googleId`, `entTrialUsed`, `telegramId`). **Fix:** real `UpdateAdminUserDto` class (or service-side field allowlist) + `ParseUUIDPipe` on `:id`.
2. **Mass-assignment on `PATCH`/`POST /admin/questions`** — `questions.controller.ts:137,70`. Same `@Body() data: any` → `prisma.question.update({data})`. Lets a caller write `isActive`, `createdAt`, FK fields. **Fix:** `UpdateQuestionDto` + allowlist in service.
3. **OTP brute-force lockout is resettable** — `auth.service.ts:238`. `requestWebCode` deletes the per-phone attempts key, so an attacker who can trigger a resend zeroes the 5-attempt lock every round and brute-forces the 6-digit code. **Fix:** don't clear attempts on request; reset only on success; throttle resends.
4. **No per-phone rate limit on OTP** — `auth.controller.ts:23-38`. Throttle is IP-only (no custom `getTracker`); rotating IPs spam OTP Telegram messages to any victim phone + enable the brute-force above. **Fix:** per-phone Redis counter + min resend interval.
5. **Access tokens: 12h, stale claims, unrevocable** — `auth.service.ts:427-464`, `jwt.strategy.ts`. `logout`/`logoutAll` only revoke refresh rows; `JwtStrategy` does no revocation check, so a leaked/post-logout access token works for 12h. **Fix:** shorten TTL (~15m) or add `tokenVersion`/`sessionId` claim checked in `validate`.
6. **Account takeover: unverified email + Google merge** *(known)* — `auth.service.ts:313-355,157-189`. `registerEmail` issues tokens with `emailVerified:false`; `authenticateGoogle` merges by email keeping `passwordHash`. **Fix:** verify email before activating; on merge of an unverified password account, clear `passwordHash`.
7. **Unauthenticated, unthrottled `POST /analytics/visit`** — `analytics.controller.ts:18-52`. No auth, no throttle, client-controlled `visitorId` → dashboard falsification + unbounded inserts into append-only tables (cost DoS). **Fix:** `@Throttle` by IP; trust the server-set `blm_vid` cookie, ignore body id.
8. **CSV formula/injection in analytics exports** — `analytics.service.ts:611-635`. Fields concatenated unescaped; an attacker-set `visitorId`/name like `=HYPERLINK(...)` executes when an admin opens the export. **Fix:** quote/escape every cell, neutralize leading `= + - @`.
9. **Kaspi webhook auth path disabled in prod** *(known)* — `billing.service.ts:352-364`. Fail-closed in code, but `KASPI_WEBHOOK_SECRET` is unset on prod, so finalization depends entirely on polling → stranded pending orders. **Fix:** set the secret + signed header, or add a scheduled reconcile sweep.

**MEDIUM**
10. **`AuthSession` not bound to IP/User-Agent** — `auth.service.ts:480-499`. `userAgentHash`/`ipHash` columns exist but are never written/checked; a stolen-not-yet-rotated refresh token is usable for 60 days from anywhere. **Fix:** populate + soft-check on refresh.
11. **FreedomPay signature uses MD5** — `freedompay-signature.ts:24`. Provider-mandated, so document it; compensate with strict server-side field validation + signed `rejected` responses. (Verify path correctly uses `timingSafeEqual`.)

**LOW** — Telegram `initData` 24h window, no replay/nonce (`telegram-auth.service.ts:49`); bulk-import token compared with non-constant-time `!==` (`bulk-import.guard.ts:38`).

### 🐞 Correctness / bugs

**HIGH**
12. **FreedomPay check-request marks unpaid orders `failed`** — `billing.service.ts:526-527,593-639`. `pg_check_url` == `pg_result_url`; the pre-payment *check* callback falls into the non-paid branch and sets `status='failed'`, so the customer can never complete payment. **Fix:** dedicated check handler (validate-only) or branch on `pg_result` presence; never `failed` on a check.
13. **FreedomPay callback returns JSON, not signed XML** — `billing.controller.ts:95-98`. Gateway requires a signed `<response>` ack; JSON → gateway retries forever / never confirms. **Fix:** return signed XML (`pg_status`+`pg_sig`).
14. **`finishTest` double-scoring race** — `test-session.service.ts:457-485`. Status checked in memory, update gated only on `id` (no status, no tx); concurrent finish (user + auto-timeout) scores twice and overwrites `finishedAt`. **Fix:** `updateMany WHERE status='in_progress'`, score inside the same tx, idempotent return.
15. **`getReview` re-scores and writes `is_correct` on a GET** — `test-scorer.service.ts:316`. A read endpoint mutates `test_answers` and can rewrite historical mistakes if option data changed. **Fix:** split `computeScore` (pure) from `finalizeAndPersist` (only in `finishTest`); `getReview` reads stored values.
16. **Manual "Run now" bypasses the notifications scheduler lock** — `notifications.service.ts:74-163`. Only the scheduler tick holds the Redis lock; the admin endpoint calls `runAutomation` directly → concurrent runs with a scheduled tick. **Fix:** acquire the same lock in `runAutomation`; 409 if busy.

**MEDIUM** — dev fixed-OTP gate is fail-open if `NODE_ENV` unset (`auth.service.ts:259`); refresh rotation not atomic (`auth.service.ts:404-421`); FreedomPay non-paid callback unconditionally `failed` (`billing.service.ts:618`); Apple `expires_date_ms` trusted blindly (`billing.service.ts:1280`); `getSession` auto-timeout can 400 on a read (`test-session.service.ts:350`); `scoreWeight`/`difficulty` clamp bypassed via `update()` (`questions.service.ts:139`); `findSimilar` discards ILIKE matches for recency rows (`questions.service.ts:340`); bulk import allows 0 answers / no correct answer (`bulk-import.dto.ts:168`); `recordVisit` dedupe check-then-insert race (`analytics.service.ts:37`); `getVisitors` paginates rows not visitors, `total` wrong (`analytics.service.ts:396`); `Number(telegramId)` lossy >2⁵³ (`telegram-bot.service.ts:561`); `hasActiveSubscription` defined 3 different ways (`admin-user.service.ts:86/123`, detail:312); Kaspi refund fuzzy-window revokes unrelated subs (`admin-finance.service.ts:101`); `refundKaspiOrder` not transactional/idempotent (`admin-finance.service.ts:59`).

**LOW** — ENT remediation scored with weighted profile points (`test-scorer.service.ts:240`); CSV export double-BOM (`questions.controller.ts:239`); `score` Decimal→Number in delivery metadata (`notifications.service.ts:732`); `deleteAccount` dead `updateMany`/redundant cascade delete (`users.service.ts:759`).

### ⚡ Performance

**HIGH**
17. **Funnel query: 5 unfiltered LEFT JOINs → Cartesian blow-up** — `analytics.service.ts:250-307`. `funnel_steps` has no uniqueness on `(visit_id, step)` and writers create many; the 5-way join multiplies rows per visit before `COUNT(DISTINCT)`. Degrades as the append-only table grows; runs on every dashboard load. **Fix:** single grouped scan with `bool_or(step=…)` per visit (or per-step `EXISTS`).
18. **`deleteAccount` can exceed the 5s tx timeout → silent rollback** — `users.service.ts:742-803`. ~15 sequential deletes in one interactive tx with no `timeout`; a heavy user blows the default 5s (P2028) and the "delete my account" silently rolls back. **Fix:** explicit `{timeout:30000}` and/or FK `ON DELETE CASCADE`.

**MEDIUM** — template lookup per `submitAnswer` (~140×/sitting) (`test-session.service.ts:414`); `GET /admin/questions` unbounded `limit` (`questions.service.ts:94`); `exportQuestions` loads all rows+relations in memory (`questions.service.ts:441`); `getOverview` re-runs the 5000-row candidate pipeline ×11 uncached (`notifications.service.ts:165`); send loop fully sequential + dedupe row before send → stuck `pending` (`notifications.service.ts:118-356`); `getProfile` ensures signup entitlements twice (`users.service.ts:47`); `getProfile` ~7 sequential round-trips incl. a subset query (`users.service.ts:53`); `getStats` loads all sessions, no LIMIT (`users.service.ts:432`); admin `getUsers` eager unbounded unused `subscriptions` include (`admin-user.service.ts:97`); `getUserDetail` runs the deep findUnique twice (`admin-user.service.ts:231`).

**LOW** — Kaspi reconcile redundant re-fetches (`billing.service.ts:713-951`); full question graph re-serialized on every `getSession` poll (`test-session.service.ts:298`); expensive generation before entitlement check (`test-session.service.ts:148`); similarity ILIKE seq-scans, no pg_trgm (`questions.service.ts:331`); `getOverview` ~44 queries/load (`notifications.service.ts:181`); `getEntHistory` non-paged unbounded (`users.service.ts:700`); `getProfile` DB write on every cache-miss GET (`users.service.ts:37`); plan-template entitlements created in a loop vs `createMany` (`admin-plan-template.service.ts:182`); ENT-pair analytics scans `test_sessions` twice (`admin-analytics.service.ts:239`).

### 🧹 Maintainability
- **Channel-membership reconcile duplicated across 4 sites with divergent logic** (auth ×2, guard, users) — `auth.service.ts:98/290` *(medium)*. Extract one `ChannelMembershipService.reconcile()`.
- Notification cooldown windows are scattered magic numbers; admin-editable `cooldownHours` is ignored for most campaigns *(medium)* — `notifications.service.ts:402-469`.
- Plan attempt-limits duplicated verbatim in `UsersService` and `AccessService` → drift risk *(medium)* — `users.service.ts:374`.
- `scrypt` via `(scryptAsync as any)` defeats typing on the KDF *(low)*; `submitAnswer` doesn't validate `selectedIds` belong to the question *(low)*; `persistAnswerCorrectness` dead feature-detection branch *(low)*; 3 near-duplicate `localizedLabel/asRecord/toNumber` helpers across admin services with divergent fallbacks *(low)*; CSV "Правильный ответ" emits `sortOrder` not text *(low)*.

### 🏛 Architecture
- **Mega-services** (the repo's own known smell): `billing.service.ts` ~1470, `test-session.service.ts` ~1216, `users.service.ts` ~829, `notifications.service.ts` ~973, `billing`+`access` ~1332 each with circular `forwardRef`. Each should move to the admission `domain/`+`infrastructure/`+thin-orchestrator shape (e.g. provider strategies for billing; a `SessionFinalizer` + `tests/domain/` for ENT rules; `TariffResolver`/`UserStatsService`/`UserDeletionService` for users).
- `findFirst` on `@unique` columns (email/phone/googleId) → TOCTOU on register + ambiguous Google merge *(low)* — use `findUnique` + handle P2002.
- `byExamType` mixes two inconsistent data sources *(low)*; `ensureDefaultCampaigns` write-on-read clobbers admin edits every tick *(low)*.

---

## Code review findings — Part 2 (remaining 8 areas, adversarially verified)

> subscriptions/access · admission · misc-modules · common/bootstrap · web-data · web-ui · shared · data-layer. Severities are post-verification; ↓ marks a reviewer "high" the verifier downgraded after reading the code.

### 🔐 Security
- **HIGH — Access & refresh tokens in `localStorage`** — `web/lib/api/storage.ts:10-27`. Any XSS exfiltrates a **60-day** refresh token → durable account/admin takeover. **Fix:** refresh token → HttpOnly/Secure/SameSite cookie; access token in memory only. *(Large: client.ts + auth-context + proxy + API.)*
- **MEDIUM ↓ — `ThrottlerGuard` configured but never registered globally** — `app.module.ts:33-40`. 17/20 controllers unthrottled (billing webhook, notifications…). *(↓ from high: auth IS throttled, webhooks are signed.)* **Fix:** `{ provide: APP_GUARD, useClass: ThrottlerGuard }` + `@SkipThrottle()` exemptions.
- **MEDIUM — Image upload trusts client `Content-Type`** — `settings.controller.ts:52-69`. No magic-byte check; unknown extension silently rewritten to `.png` → arbitrary bytes under `/uploads` (blunted today by `nosniff`). **Fix:** validate magic bytes / re-encode via `sharp`; reject unknown ext.
- **MEDIUM — 500s leak internal messages outside prod** — `all-exceptions.filter.ts:39-101`. Fail-open on `NODE_ENV!=='production'` exposes stack/Prisma text on staging/misconfig. **Fix:** redact unless explicitly opted-in.
- **MEDIUM — Proxy relays upstream `Set-Cookie`/`Cookie` cross-origin** — `web app/api/v1/[...path]/route.ts:49-58`. Mixes api/web cookie jars. **Fix:** explicit cookie policy at the proxy.
- **LOW** — `checkChannelMembership` counts Telegram `restricted` (removed) users as members (`telegram-bot.service.ts:442`); `RichText` injects unsanitized KaTeX HTML — admin-only input today, but a stored-XSS sink if bulk-import content ever reaches it (`rich-text.tsx`).

### 🐞 Correctness / bugs
- **MEDIUM — `trust proxy` never enabled behind nginx** — `main.ts`. Throttler keys on the proxy IP (per-IP limits defeated) and the lead-notification "IP" is spoofable. **Fix:** `app.set('trust proxy', 1)`, drop manual `x-forwarded-for` parsing.
- **MEDIUM ↓ — Admission Redis cache has no invalidation** — `admission.service.ts:30-47`. Stale проходные баллы for ≤10 min after a re-seed. *(↓ from high: bounded TTL, only the offline seeder mutates cutoffs.)* **Fix:** per-cycle version counter in the key, `INCR` on cutoff rewrite.
- **MEDIUM — Denied-attempt ledger row lost on rollback** — `access.service.ts:153-175`. The denial audit insert is inside the txn that then throws → never committed (no audit trail for blocked attempts). **Fix:** write denials outside the failing txn.
- **MEDIUM — Legacy `entTrialUsed` dual-write drift** — `access.service.ts:190-198`. Mirror counter diverges from the canonical entitlement → extra free attempts if V2 is ever rolled back. **Fix:** mirror the actually-chosen source + backfill before rollback.
- **MEDIUM — Silent truncation `take:15000`/`8000`** — `admission.repository.ts:82,51`. A large cycle silently drops programs/universities with no signal. **Fix:** SQL aggregation (below) or detect+warn.
- **MEDIUM — `PrismaService` has no tx timeout / pool config / shutdown hook** — `database/prisma.service.ts`. Interactive txns inherit the 5s default (cf. `deleteAccount`); no `enableShutdownHooks()` so connections may not drain on SIGTERM. **Fix:** explicit `transactionOptions`, pool params, `app.enableShutdownHooks()`.
- **MEDIUM — Kaspi order↔plan card matched `planCode === plan.id`** — `web dashboard/billing/page.tsx:392`. If the backend stores the plan *code*, the resume-payment state breaks → duplicate orders / `PENDING_ORDER_EXISTS`. **Fix:** match on the identifier the backend actually stores.
- **LOW** — db-snapshot leaves a partial `.dump` on failure (`db-snapshot.service.ts:176`); `resolveMediaUrl` drops bare relative paths (`web client.ts:154`); 401-retry gives no distinct `SESSION_EXPIRED` code (`web client.ts:106`); Kaspi poll doesn't pause on hidden tab; `clamp(NaN)` propagates NaN through `totalEntScore` (`shared entGrantModel.ts:37`); exam timer guard can't fire `onZero` when armed already at 0 *(verifier: latent — server auto-finishes first)*.

### ⚡ Performance
- **MEDIUM ↓ — `getUserAccessByExam` mutates state on a read** — `access.service.ts:256-283`. A profile read runs per-exam upserts/`updateMany` inside a txn that contends with the consume path; ensure-signup also runs **twice** per `/users/me`. *(↓ from high: V2-gated, ENT-only heavy path.)* **Fix:** move reconciliation off the read path; drop the duplicate ensure call.
- **MEDIUM — Admission `take:15000` + group in Node** — `admission.repository.ts:73-83`. Push the GRANT/RURAL collapse into SQL (`DISTINCT ON`/`groupBy`); make `listChanceProfileSubjects` a `distinct` query, not a full resolve.
- **MEDIUM — Legacy reconcile N+1** — `access.service.ts:646-706`. Per-exam × per-subscription `COUNT` inside the txn. **Fix:** batch into one grouped query.
- **MEDIUM — recharts eager in the dashboard bundle** — `web dashboard/page.tsx:20`. Heaviest route ships a charting lib even with no chart data. **Fix:** `next/dynamic({ ssr:false })`.
- **MEDIUM — Append-only tables: no retention/partitioning + no scheduler** — `visit_events`/`funnel_steps`/`attempt_usage_ledger`/`notification_deliveries` grow unbounded (no `@nestjs/schedule` anywhere). **Fix:** retention job + monthly RANGE partitioning.
- **MEDIUM ↓ — No connection-pool sizing / PgBouncer** — `prisma.service.ts`, `.env`. Default pool per instance. *(↓ from high: single instance today.)* **Fix:** `connection_limit`/`pool_timeout`, PgBouncer before horizontal scale.
- **LOW** — landing-image uploads never GC'd → disk leak (`settings.controller.ts:73`); `RedisThrottlerStorage` 4-6 RTTs + non-atomic no-TTL race (`redis-throttler-storage.ts:26`); `recordVisit` POSTs on every SPA navigation (`web providers.tsx:12`); redundant indexes survive the drop pass (`test_sessions (status,finishedAt)`, `payment_orders` status overlap); ENT-pair analytics double-scans `test_sessions`.

### 🧹 Maintainability
- **MEDIUM — Dead duplicate `I18nResponseInterceptor`** — `i18n-response.interceptor.ts`. Unreferenced and diverges from the live interceptor → footgun. **Fix:** delete.
- **MEDIUM — `validators/index.ts` Zod schemas are all dead code** — `shared`. Never imported; `zod` dep exists only for them; drift from the real DTOs. **Fix:** delete (drop `zod`) or wire them in as the contract.
- **MEDIUM — web `types.ts` re-declares `@bilimland/shared` admission/ENT DTOs** — `web lib/api/types.ts:411-470`. Web imports nothing from shared → drift. **Fix:** import + extend the shared DTOs.
- **MEDIUM — ENT total re-summed inline + `/140` hardcoded on web & mobile** — `web admission/page.tsx:91`, `mobile AdmissionView.tsx`. Exactly the duplication CLAUDE.md warns about. **Fix:** `totalEntScore` + `ENT_TOTAL_MAX` from shared (admin already does this).
- **LOW** — `resolveMediaUrl` reimplemented 3× with a divergent `/uploads` check; `parseTimestamp` duplicated across billing pages; exam toasts hardcoded Russian; ENT badge thresholds (100/70) unrelated to real шектік балл; checkout modal is a hand-rolled overlay, not the accessible `Dialog`; shared dead exports (`splitReadingStem`, profile helpers, `maskPhoneDigits`); `ValidationPipe` lacks `transformOptions`.

### 🏛 Architecture
- **MEDIUM — 3 independent V2 flags = untested 8-state matrix** — `access.service.ts:79-90`. Silent inconsistencies (e.g. V2-off + dual-write writes rows nothing reads). **Fix:** collapse to one `mode` enum (LEGACY|DUAL|V2) + validate legal combos at startup.
- **MEDIUM — `AccessService` is a 1347-LOC mega-service** — decision + reconciliation + persistence + hand-rolled timezone math; summary and gate re-implement the same math (can drift). **Fix:** domain/repository split like admission.
- **MEDIUM — Status `VarChar` columns should be Postgres enums** — `TestSession.status`, `NotificationDelivery.status`, `NotificationRun.status`. A typo silently drops rows from `status IN (...)` filters. **Fix:** enum-migrate the lifecycle columns.
- **LOW** — global `I18nInterceptor` registered via `new …()` can't inject `Reflector` (blocks the `@SkipI18n` fix); Redis client has no `error` listener + `enableOfflineQueue:false` (transient blip → 500s); inconsistent FK `onDelete` (implicit Restrict on `User` relations vs app-side cascade); GIN index on `questions.metadata` declared but never created (schema drift); **no CHECK constraints** on any numeric invariant (defense-in-depth; verifier: not presently exploitable).

---

## Optimization plan (prioritized)

### P0 — now (security + data integrity; mostly small)
| # | Item | Effort | Risk | Staging? |
|---|---|---|---|---|
| 1 | DTOs/allowlists for `PATCH /admin/users` + `/admin/questions` (mass-assignment #1,#2) | S | low | no |
| 2 | OTP: stop clearing attempts on resend + per-phone rate limit (#3,#4) | S–M | low | no |
| 3 | `/analytics/visit`: throttle + trust cookie id; escape CSV exports (#7,#8) | S | low | no |
| 4 | FreedomPay check-vs-result split + signed-XML ack (#12,#13) | M | **high** | **yes** |
| 5 | `finishTest` atomic finalize + `getReview` no-write-on-GET (#14,#15) | M | med | yes |
| 6 | Set `KASPI_WEBHOOK_SECRET` + scheduled reconcile sweep for stranded pending (#9) | M | med | yes |
| 7 | `app.set('trust proxy', 1)` + register `ThrottlerGuard` as global `APP_GUARD` | S | low | no |
| 8 | Fail-closed 500-error redaction; delete dead `I18nResponseInterceptor` | S | low | no |
| 9 | Admission cache invalidation (per-cycle version counter) — fixes stale проходные баллы | M | low | no |

### P1 — this sprint
- Access-token TTL/revocation (#5); email-verification + Google-merge hardening (#6) — **staging**.
- **Tokens out of `localStorage`** → HttpOnly cookie for refresh, access in memory — **staging** (touches client/proxy/API).
- Funnel de-fan-out (#17) and `deleteAccount` tx timeout/cascade (#18); `PrismaService` tx-timeout + `enableShutdownHooks()` + pool params.
- `getUserAccessByExam` off the read path + drop the double ensure-signup; legacy reconcile batching.
- Notifications: manual-run lock (#16), `Number(telegramId)`→string, `getOverview` count-not-fetch + cache.
- `users` hot path: drop double entitlement call, parallelize reads, cap `getStats`/`getEntHistory`.
- admin `getUsers`/`getUserDetail` query cleanup; unify `hasActiveSubscription` definition.
- Unify channel-membership reconcile; questions: clamp `limit`, stream export, fix `findSimilar` merge, bulk-import answer validation.
- Image-upload magic-byte validation + landing-image GC; recharts dynamic import; admission SQL aggregation + truncation guard; denied-ledger-outside-txn; Kaspi card-match identifier.

### P2 — backlog
- Split the mega-services into domain/infrastructure (billing providers, `SessionFinalizer`, users sub-services, `AccessService` domain/repo).
- Collapse the 3 V2 flags into one `mode` enum + startup validation; SQL-side admission aggregation; `I18nInterceptor` no-clone + `@SkipI18n` (needs `APP_INTERCEPTOR` registration); pg_trgm similarity.
- DB: `CHECK` constraints, status `VarChar`→enums, partition + retention for append-only tables, PgBouncer, FK `onDelete` consistency, fix the `questions.metadata` GIN-index drift.
- Refresh-token IP/UA binding; `RedisThrottlerStorage` single-Lua atomic + Redis `error` listener; dedupe shared limits/helpers/types into `@bilimland/shared`; delete `validators/index.ts` dead code (+drop `zod`) and other shared dead exports.

---

## Known-open risks (status)
- **Tokens in `localStorage`** — 60-day refresh token exfiltratable by any XSS. *Open (P1, verified high).*
- **Kaspi webhook fail-open** — secret unset on prod; finalization depends on polling. *Open.*
- **FreedomPay check-vs-result + JSON-not-XML ack** — can mark unpaid orders failed / gateway never confirms. *Open (P0, confirm before touching live billing).*
- **Email/Google account-merge takeover** — unverified email becomes a usable identity. *Open.*
- **Mega-services** — billing/users/test-session/notifications/access still monolithic. *Open (P2).*
- **Stranded paid Kaspi orders** — pre-fix victims still need manual reconciliation via `sync_subscription.ts`. *Open (ops).*

## Definition of done — how to get to "perfect"
1. **Tests where money/scoring/auth live** — no unit tests exist for the scorer, entitlement accounting, or payment callbacks. Add: scorer round-trip + ENT weighting (incl. the 3–5pt partial-credit gap); `assertAndConsumeAttempt` concurrency (double-spend); FreedomPay/Kaspi callback (paid/check/failed/replay); password hash round-trip; the V2 flag matrix (LEGACY/DUAL/V2).
2. **CI gate** — `lint` + `tsc --noEmit` (web/api) + `test:api` + Playwright on PR, plus a `prisma migrate status` drift check (catches the `metadata` GIN-index drift). Root `package.json` is restored, so `turbo` works.
3. **Staging-first for the risky ones** — auth-flow, payment callbacks, and the `localStorage`→cookie migration go through `staging.my-test.kz` before prod.
4. **Verify each fix** by typecheck + the new targeted test; deploy via the committed git pipeline (no hand-edits on the server — the server can't push to GitHub).
5. **Coverage:** all 16 areas reviewed; part-2 findings are adversarially verified, part-1 are reviewer-asserted (re-verify the FreedomPay items first).
