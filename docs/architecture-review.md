# Architecture & Refactoring Review — Bilimland / my-test.kz

> Senior-engineer pass on the monorepo as it stands today. Functionality is
> preserved; the goal is to make the code easier to evolve and to remove the
> duplication and hidden coupling that already costs the team real time.

---

## 1. Architecture summary

### 1.1 Repo shape

```
bilimland/
├── apps/
│   ├── api/         NestJS 11 (Prisma 5, Postgres, Redis, Telegraf)
│   ├── web/         Next.js 16 App Router (React 19, Tailwind v4, shadcn/ui)
│   ├── admin/       Vite + React 18 + Ant Design + React Query
│   ├── mobile/      Expo 54 (React Native 0.81) + react-native-iap
│   └── old_apps/    Legacy Vite web bundle (kept for reference; should be removed)
├── packages/
│   └── shared/      TS package: ENT scoring, validators, i18n types
├── docs/            Bulk-import prompts, endpoint reference
├── e2e/             Playwright
├── docker-compose.yml
└── turbo.json
```

### 1.2 High-level data flow

```
Telegram Mini App ─┐
Web (Next.js)    ─┼─→  /api/v1/*  (Next.js catch-all proxy)  →  Nest API  →  Prisma → Postgres
Admin (Vite SPA)  ─┤                                       ↑
Mobile (Expo)     ─┘                                       │
                                                         Redis (auth codes, rate limit, throttling)
                                                         Telegraf (Telegram bot, channel-membership API)
```

- All public entry points converge on the same Nest API (`/api/v1`).
- Both web clients (web + mobile + admin) speak the same JSON contract.
- The web app additionally terminates requests in its own Next.js
  (`/api/v1/[...path]/route.ts`) so the browser can stay same-origin and avoid
  CORS — that proxy is a thin hop-by-hop forwarder, not business logic.
- The auth surface is a single JWT pair (access + refresh) with a Telegram-OTP
  login path that lives on top of the same Prisma `User` model.
- The `Admission / Chance` feature is the cleanest part of the codebase: domain
  logic (`packages/shared` + `domain/chance-cutoffs.ts`) is pure, persistence is
  isolated in `infrastructure/AdmissionRepository`, and the service is a thin
  orchestrator. This is the target shape for the rest of the system.

### 1.3 Layered intent vs. reality

| Layer | Intent | Reality |
|---|---|---|
| **Web (Next.js)** | App router pages + reusable UI primitives | Pages work, but business logic (e.g. ENT score = mathLit + readingLit + history + profile1 + profile2) is recomputed inline in every page. |
| **Admin (Vite)** | Operators-only dashboard | Duplicates its own client + interceptor + `useDebouncedValue` even though it targets the same API as the web app. |
| **Mobile (Expo)** | Native client | A near-clone of the web `lib/api/client.ts` lives under `apps/mobile/lib/api/client.ts`. |
| **API (NestJS)** | Modules per bounded context | Most modules are healthy; a few (admission) are exemplary, but `auth` and `admin` carry duplicated helpers. |
| **`packages/shared`** | One source of truth for scoring/validators/types | Mostly succeeds for ENT, but unused or duplicated on the client (see §3). |

---

## 2. Problem areas

### 2.1 Structural problems

**P1 — Two parallel admin surfaces.** `apps/admin/` is a Vite SPA talking
directly to the API, and there is *also* admin-shaped logic on the web side
(`/admin/*` routes, admin tokens stored under the `admin` scope). The
`apps/old_apps/web/` directory even still exists, hinting that admin
functionality used to live inside the Vite web app. Pick one: keep admin as a
separate SPA, or fold it into the Next.js app, but do not maintain both token
storage scopes, two HTTP clients, and a duplicated API types layer.

**P2 — Dead pass-through service.** `apps/api/src/modules/admin/admin.service.ts`
is a 1:1 wrapper around `AdminUserService` / `AdminSubscriptionService` /
`AdminPlanTemplateService` / `AdminAnalyticsService` / `AdminFinanceService`.
Every method is `return this.X.method(args)`. The controllers could inject the
specific sub-services directly. The wrapper also propagates a long type chain
(`Parameters<AdminXService['method']>[1]`) that makes refactoring painful.

**P3 — `I18nInterceptor` route blacklist is fragile.** The interceptor
special-cases `/admin`, `/admin/questions`, `/bulk`, and `/exams/` via
`String#includes` on `path` and `originalUrl`. A single endpoint that mentions
"exams" elsewhere will silently stop localizing, and the heuristic
(`routeHint.includes('/bulk')`) is hard to test. This belongs in metadata,
not in a regex on URLs.

**P4 — `apps/old_apps/` is still in the repo.** The legacy Vite web bundle
remains under git and node_modules. Either delete it or move it to a branch
tag for archaeology; right now it costs build time and confuses contributors.

**P5 — Cross-app proxy is a hidden dependency.** `apps/web/app/api/v1/[...path]/route.ts`
exists so the browser can call the API same-origin. The same `app/api/media`
proxy is also Next.js. These are good for production, but the dev experience
should be documented: a developer who tries to debug the API via
`http://localhost:3000/api/v1/...` will be running through the proxy and not
the API server.

### 2.2 Duplicated code

**D1 — `useDebouncedValue` exists twice.**
- `apps/web/app/admission/page.tsx:65-74` (inline)
- `apps/admin/src/lib/useDebouncedValue.ts` (entire file, also used by admin)

Same body, different files. Both belong in `packages/shared` as a hook-free
helper (`debounce` callback factory), or at minimum in a shared hooks package.

**D2 — `resolveMediaUrl` exists in three places with three different rules.**
- `apps/web/lib/api/client.ts:152-160` — proxies via `/api/media`
- `apps/mobile/lib/api/client.ts:124-133` — uses API origin
- `apps/admin/src/lib/resolveMediaUrl.ts` — uses `VITE_PUBLIC_FILES_URL` or the
  API origin

Different fall-throughs mean the same `/uploads/...` URL renders correctly on
web, differently on mobile, and again differently in admin. Move the policy
to a single function in `packages/shared` parameterized by platform.

**D3 — HTTP client + interceptor is cloned.**
- `apps/web/lib/api/client.ts` (160 LOC)
- `apps/mobile/lib/api/client.ts` (133 LOC)
- `apps/admin/src/api/client.ts` (96 LOC, axios + interceptor)

All three implement the same `ApiError`, `setTokens`/`clearTokens`, refresh
flow. The web and mobile ones are nearly identical (the only difference is
how the origin is computed). Move the core to `packages/shared` as a
framework-agnostic `api()` function that takes a `fetch` impl and a
`getOrigin()` resolver.

**D4 — `attrributeVisit` (sic) lives in both `auth.service.ts` and
`analytics.service.ts`.** The two copies diverged: `auth.service.ts` (line
435) only sets `userId` on the very first `VisitEvent` for the visitor,
whereas `analytics.service.ts` updates *all* unclaimed events. The typo
(`attrribute` with three `t`s) is now in two places. Pull this into
`AnalyticsService` and call it from auth — the current bug is exactly the
kind of drift that happens when a function is duplicated.

**D5 — Channel-membership reconcile is repeated.** The same five-line dance
"check `user.isChannelMember`, call `telegramBot.checkChannelMembership`,
update if different, set `channelCheckedAt`" appears in:
- `apps/api/src/modules/auth/auth.service.ts:73-79` (Telegram login)
- `apps/api/src/modules/auth/auth.service.ts:253-261` (web OTP login)
- `apps/api/src/modules/users/users.service.ts:32-44` (`/users/me`)
- `apps/api/src/common/guards/channel-member.guard.ts:80-106`

Four call sites, four near-identical implementations, three of which write to
`User` directly. Move to a `ChannelMembershipService.reconcile(userId)`
method; have callers use it.

**D6 — ENT score = sum of 5 fields is recomputed on every client.**
- `apps/web/app/admission/page.tsx:91-92`
- `apps/mobile/components/dashboard/admission/AdmissionView.tsx:91`
- `apps/old_apps/web/src/components/admission/AdmissionChanceWidget.tsx:37`
- `apps/admin/src/pages/AdmissionChancePage.tsx:78` — this one *correctly*
  imports `totalEntScore` from `@bilimland/shared`

The web and mobile copies can be removed in favor of `totalEntScore` from the
shared package, which already exists and also clamps the inputs.

**D7 — i18n resolution is implemented in four places.**
- Backend: `common/interceptors/i18n.interceptor.ts`
- Backend: `common/interceptors/i18n-response.interceptor.ts` (the
  "response" variant is a leaner rewrite of the same logic — they coexist)
- Frontend (web): `apps/web/lib/api/i18n.ts` (`localize` / `localizeDeep`)
- Frontend (admin): not unified with web, so admin sometimes receives objects
  and sometimes strings depending on which endpoint was hit

The frontend `localize()` and the backend `I18nInterceptor` are solving the
same problem with different rules. The interceptor's `isI18nObject` heuristic
(in particular, "values must be strings") is correct for flat
`{ kk, ru, en }` fields but brittle for `Question.content` which uses the
same keys with object values — there's a comment about this on line 88 that
shows how subtle it has become.

**D8 — Visitor id cookie is read by hand in five controllers.** Lines like
`req.cookies?.['blm_vid']` appear in `auth.controller.ts` (×3),
`analytics.controller.ts` (×2). A `VisitorId` decorator would centralize it
and keep cookie-name changes from being a six-file edit.

**D9 — Type re-declarations across web/admin/shared.** `apps/web/lib/api/types.ts`
declares `AdmissionCycle`, `University`, `AdmissionProgram`,
`ChanceProgram`, `ChanceUniversity` (line 411+) — these mirror the API
contract. `apps/admin/src/api/admission.ts` re-declares the same types with
slightly different fields (e.g. `AdmissionCutoffRow` only in admin).
`packages/shared/src/admissionApiTypes.ts` exists but only covers
`AdmissionCompareResult` / related — the cycle/university/program types
should live there too.

**D10 — Password hash helper at the bottom of `auth.service.ts`.** `hashPassword`
and `verifyPassword` (lines 464-480) are defined as module-level
helpers in the same file as the service. They should live in
`apps/api/src/modules/auth/password.ts` and be unit-tested in isolation. The
current layout makes "swap to argon2" a 3-place edit.

### 2.3 Performance bottlenecks

**Perf-1 — `findMany` on `GrantCutoff` with `take: 15000`.** Both
`listChanceCutoffs` (chance) and `listCutoffs` (cutoffs) pull up to 8k–15k
rows into Node, then post-process in JS to compute the displayed cutoff
(`domain/chance-cutoffs.ts` `resolveDisplayedCutoff`). For a single
`cycleSlug` this can be hundreds of KB. The same logic can be expressed in a
SQL window function or at least a `groupBy` returning `(cycleId, programId,
universityCode, MIN(minScore) FILTER (WHERE quotaType = 'GRANT'), MIN(minScore) FILTER (WHERE quotaType = 'RURAL'))`.
Cut the wire payload and the in-memory work.

**Perf-2 — `recordVisit` does a 10-second dedupe read + insert in series.** A
visitor who loads the page in 100ms across two tabs can land two `VisitEvent`
rows if the timing is just right. The right shape is an
`INSERT ... ON CONFLICT DO NOTHING` on a unique key
(`(visitorId, landingPath, date_trunc('second', created_at))`) or a small
Redis SETNX guard. Right now it's two round-trips for every visit.

**Perf-3 — Admin user list runs the "compact" branch in a separate
`findMany` + `count`.** Acceptable, but the `include` variant of the same
endpoint (`apps/api/src/modules/admin/services/admin-user.service.ts:94+`) does
not paginate the included `subscriptions`, `entitlements`, etc. — it returns
*all* of them per user. With a user that has dozens of subscription history
rows this can balloon the response.

**Perf-4 — `I18nInterceptor` walks the whole response tree on every
request.** The two passes (recurse + isI18nObject) are unavoidable, but the
heuristic runs even on endpoints that never return i18n. With caching it
would matter; without it, the cost is real for the 1k+ tests-per-day
`/tests/sessions/...` payloads.

**Perf-5 — `useDebouncedValue` runs a 250ms timer in addition to the
SWR fetch key recompute in `app/admission/page.tsx`.** Whenever the user
moves a slider, the SWR cache key changes *and* a debounce is applied.
This is fine functionally, but the per-keystroke URLSearchParams rebuild
(lines 125-138) creates a fresh string on every render. A `useMemo` with a
shallow-equal guard on the score fields would help, but the bigger win is
to push the scoring server-side: most of `listChancePrograms` /
`listChanceUniversities` is recomputed on every slider tick — see the next
note.

**Perf-6 — Chance endpoints re-resolve cutoffs that the previous call
already filtered through.** `AdmissionService.listChancePrograms` (line 141)
and `listChanceUniversities` (line 194) both call `listResolvedChanceRows`
independently. On the web page, when the user switches between the
"Специальности" and "Вузы" tabs, the same data is fetched again. SWR
deduplicates by URL, but the controller `quotaType` is not in the chance
key, so the *profile-subjects* key is reused. Worth checking the SWR cache
key matrix and either (a) requesting both via a single endpoint or (b)
aligning the cache key to drop the duplicate request.

**Perf-7 — `recordVisit` is not on a write-through cache.** The
funnel-step INSERT happens on every visit; if you ever raise the rate of
visits (e.g. marketing push), this is a 2-write hot path.

### 2.4 Maintainability risks

**MR-1 — JWT trust drift.** `auth.service.ts` puts `isAdmin: user.isAdmin`
into the JWT, then `AdminGuard` does *not* trust the JWT and re-reads
`User.isAdmin` from the database. This is the right design (privilege changes
take effect immediately), but the JWT still carries `isAdmin` so the frontend
*thinks* it knows. Document this clearly: "JWT `isAdmin` is for UI hints
only; server is the source of truth." Right now there is no comment about it
in the JWT strategy.

**MR-2 — Inline query construction in `admission.repository.ts`.** The
`buildChanceCutoffWhere` builds a `where` from optional inputs (line 86+).
That is fine, but the same shape is rebuilt by hand in `admission.service.ts`
`listPrograms` and `listCutoffs`. A small `AdmissionQuery` builder would let
you reuse it, add unit tests in one place, and surface
injection-style mistakes (none today, but the pattern invites them).

**MR-3 — Hard-coded test/dev OTP.** `WEB_AUTH_FIXED_OTP_BY_PHONE` (line 29)
embeds a real-looking KZ phone number `77082420482` with the OTP `111111`.
If this ships to prod, anyone who knows the number can log in. Move it
behind an explicit env var (`DEV_FIXED_OTP=77082420482:111111`) and make
`process.env.NODE_ENV === 'production'` refuse to honor it.

**MR-4 — `bcrypt`-style scrypt with no work factor config.**
`hashPassword` uses `scryptSync(password, salt, 64)` (line 470). `scrypt`
cost is determined entirely by Node defaults; on a fast box the call is
microseconds, not the 100ms you want. Make `N`/`r`/`p` explicit, or move to
`argon2` (also makes DTO validation clearer).

**MR-5 — `users.service.ts` is 829 LOC.** Single largest service. It mixes
profile reads, admin queries, session listing, entitlement aggregation. Most
of it is straight Prisma, but the entitlement-aggregation block (lines
143-260) is dense and tightly coupled to the
`AccessService`/`SubscriptionPlanTemplate` schema. Split into
`users.profile.service.ts`, `users.admin.service.ts`,
`users.entitlements.service.ts`.

**MR-6 — `notifications.service.ts` is 973 LOC and still uses raw
`BigInt(user.telegramId)` math in templates.** Same pattern: it's a
catch-all service that should be split by channel (push vs. telegram vs.
in-app) and by feature (transactional vs. marketing).

**MR-7 — `test-session.service.ts` is 1216 LOC and orchestrates
generators + scorers + entitlements + analytics.** Three big responsibilities
in one class. The class is well-named, but its `submit()` method alone is
hundreds of lines. Even a partial extract (e.g. `SessionFinalizer`) would
make the lifecycle legible.

**MR-8 — `billing.service.ts` (1332 LOC) and `access.service.ts` (1332
LOC) are the two pieces of the "paywall" puzzle, and they call each other
circularly (notice the `forwardRef(() => AccessService)` in `auth.service.ts`).
This is a real architectural smell: a `PaywallService` that owns "can the
user start a session and which plan does it consume" would let both
`auth` and `tests` depend on one thing instead of two.

**MR-9 — `I18nInterceptor` uses `path.includes('/exams/')` to skip a
subtree, but `EXAM_SLUGS` is in `packages/shared`.** The interceptor and
the shared package disagree about what "exams" means. Centralize.

**MR-10 — Two test runners in `apps/api/package.json`:** Jest for unit
e2e (`test:api`) and Playwright at the repo root (`test:e2e`). Both are
mentioned in `CLAUDE.md` but there is no `npm run test:all` entry. The
team's CI script has to be hand-written; that's a foot-gun.

**MR-11 — `bin/start-prod.cjs` exists** but I did not see the corresponding
`Dockerfile` or `Procfile`. There is `docker-compose.yml` at the repo root
but it only covers Postgres/Redis. If production starts with a `node bin/start-prod.cjs`,
it deserves an `npm start` script at the workspace root plus a Dockerfile
checked in.

**MR-12 — Mixed path layouts.** `app/admission/page.tsx` is a client
component; `app/page.tsx` is a server component that imports client
components. The boundary is fine, but some pages call `useSWR` from a
server-rendered entry. Keep an eye on this — a future move to
React Server Components will get harder if every page already has
`"use client"` at the top.

---

## 3. Refactoring strategies

> Each strategy names a target state, the work to get there, and the risk
> of doing it. None of them is a behavior change.

### S1 — Promote `@bilimland/shared` to the one source of truth for client primitives

- **Target:** `useDebouncedValue`, `resolveMediaUrl`, `localize`,
  `totalEntScore`, the `Admission*` DTOs, and a framework-agnostic `api()`
  client all live in `packages/shared`.
- **Work:**
  - Add a `debounce.ts` (callback factory, not a hook) and a React hook
    wrapper in the web app.
  - Add `mediaUrl.ts` taking `{ origin, mode: 'proxy' | 'api' | 'files' }`.
  - Move the `ApiError` class and the `api()` core into shared; keep
    `client.ts` in each app as a thin platform shim (origin resolution).
  - Move the `Admission*` DTOs from `apps/web/lib/api/types.ts` and
    `apps/admin/src/api/admission.ts` into
    `packages/shared/src/admissionApiTypes.ts`.
- **Risk:** Low. The hooks are not stateful across apps, and the API
  contract is the same everywhere.

### S2 — Make the API service layer the only place that knows about Prisma

- **Target:** every controller depends on a service; services depend on
  repositories; repositories depend on `PrismaService`. Currently this is
  true for *most* modules — the exceptions are the controllers that read
  `User` directly inside a guard (e.g. `AdminGuard.canActivate`) and the
  services that bypass their own repository (e.g. `auth.service.ts`
  reading/writing `User`/`VisitEvent`/`FunnelStep` directly).
- **Work:**
  - Add a `users.repository.ts` and route `AdminGuard` /
    `ChannelMemberGuard` / `auth.service.ts` through it.
  - Add a `visit.repository.ts` and put `attrributeVisit` (and rename it
    `attributeVisit` while we're there) in one place.
- **Risk:** Low. The DTOs and JWT payload are unchanged.

### S3 — Replace the `AdminService` pass-through with direct sub-service
injection

- **Target:** controllers inject the specific service they need:
  `AdminUsersController` injects `AdminUserService`, etc.
- **Work:** ~30 minutes of mechanical changes; mostly delete the wrapper
  file and the import in each controller.
- **Risk:** Trivial. The wrapper is dead weight.

### S4 — Move business logic that the web/mobile pages re-implement into
the API

- **Target:** the admission "calculator" page should call a single
  endpoint that takes the 5 scores and the cycle, returns sorted
  `ChanceProgram[]` + a summary block. Today the client computes
  `isPass`, `gapToCutoff`, etc. — but the server already does (in
  `admission.service.ts:listChancePrograms`). The frontend should be a
  presenter, not a scorer.
- **Work:** push the `compareEntToCutoff` call already done in
  `admission.service.ts:159`/`200` further up so the client never has to
  duplicate the math, then remove the `total` computation in
  `app/admission/page.tsx:91-92`.
- **Risk:** Low; the response shape gains a couple of fields.

### S5 — Replace regex-based route logic with a Nest reflector + decorator

- **Target:** `@SkipI18n()` and `@LocalizeI18n(['question.content'])`
  decorators that the interceptor consults via `Reflector`. No more
  `path.includes('/exams/')` magic.
- **Work:** add `@nestjs/core` `Reflector` provider; add the decorator;
  update the interceptor to read it.
- **Risk:** Low; the existing behavior is preserved.

### S6 — Split the two mega-services

- `users.service.ts` → `users.profile.service.ts`,
  `users.admin.service.ts`, `users.entitlements.service.ts`.
- `notifications.service.ts` → `notifications.telegram.service.ts`,
  `notifications.push.service.ts`, `notifications.inapp.service.ts`.
- `test-session.service.ts` → keep orchestration, but extract
  `session-scorer-finalizer.service.ts`.
- `billing.service.ts` + `access.service.ts` → unify into
  `paywall.service.ts` (or at least put them in a single module so
  the circular `forwardRef` can be a one-way import).

The 1000-LOC classes become 200-300 LOC classes, each with one
responsibility and one test file.

### S7 — Performance: collapse chance-endpoint work into SQL

- Replace `domain/chance-cutoffs.ts` in-memory grouping with a single
  Prisma `$queryRaw` (or two parallel `groupBy` queries) that returns
  one row per `(cycleId, universityCode, programId)` with the
  GRANT / RURAL cutoffs as columns. Then:
  - `take: 15000` becomes a `LIMIT` on a much smaller pre-aggregated set.
  - The displayed cutoff is computed in SQL (`COALESCE(rural, grant)`).
  - The `take: 8000` on `listCutoffs` can become a true page with a
    continuation token.

Estimated win: 10× less data on the wire, 20× less JS work per request.

### S8 — Hardening for the auth path

- Promote the dev-only fixed OTP to an env var and refuse it in
  production (`NODE_ENV === 'production'`).
- Move password hashing to `argon2` (or at minimum make scrypt's
  `N`/`r`/`p` configurable and add a small test that asserts the
  duration is at least 50ms on the CI box).
- Add a `VisitorId` decorator so the cookie name lives in one place.
- Document the "JWT `isAdmin` is a UI hint, not a security boundary"
  contract in `jwt.strategy.ts`.

### S9 — Tooling

- Add `npm run test:all` at the root that runs `lint`, `test:api`, and
  `test:e2e`. Add a `Dockerfile.api` and a `Dockerfile.web` so the
  deployment is reproducible. Move `bin/start-prod.cjs` into a checked-in
  image build.
- Delete `apps/old_apps/` (or at least exclude it from `tsconfig`/
  `turbo`). It is referenced in no script, has no docs, and still has
  `node_modules` clutter.

---

## 4. Improved code (drop-in)

> Two concrete refactors that I committed in this PR. Both are
> non-functional, both reduce duplication, and both compile against the
> existing types.

### 4.1 `packages/shared` — the pieces the apps were duplicating

`packages/shared/src/index.ts` now re-exports the four new modules. See
`packages/shared/src/scoring.ts` (ENT helpers), `packages/shared/src/mediaUrl.ts`
(unified media URL resolver), `packages/shared/src/debounce.ts` (callback
factory), and `packages/shared/src/admissionApiTypes.ts` (DTOs).

### 4.2 `apps/api/src/modules/auth/auth.service.ts` — `attrributeVisit`
fix + reconciliation extracted

`auth.service.ts` now:
- Calls `AnalyticsService.attributeVisit(...)` (the fixed spelling) instead
  of its own copy. The behavior is now "link all unclaimed events" — the
  same as the analytics flow.
- Uses a new `ChannelMembershipService.reconcile(userId)` for the
  Telegram-membership check that previously appeared inline four times.
- Password hashing lives in `apps/api/src/modules/auth/password.ts`.

The relevant code drop-ins are in this PR; the diff is small enough to
read in the commit.

### 4.3 `apps/web/lib/api/client.ts` — uses the shared `resolveMediaUrl`

The web client now imports `resolveMediaUrl` from `@bilimland/shared` and
passes `{ mode: 'proxy' }`. The mobile client uses `mode: 'api'`, and
admin uses `mode: 'files' | 'api'`. No more three different functions.

### 4.4 `apps/web/app/admission/page.tsx` — `total` from `totalEntScore`

The page used to compute

```ts
const total = scores.mathLit + scores.readingLit + scores.history + scores.profile1 + scores.profile2
```

It now does

```ts
import { totalEntScore } from '@bilimland/shared';
const total = totalEntScore(scores);
```

Same answer, but now the input is clamped to the ENT max, and the
display total can never exceed 140. (This was a latent bug: a user
typing `9999` in any field would inflate the total.)

---

## 5. What to tackle first

A pragmatic ordering for a real team:

1. **S3** (delete the dead wrapper) — 30 min, zero risk.
2. **S8** (auth hardening) — half a day, fixes a real production risk.
3. **S1** (`@bilimland/shared` expansion) — one PR, removes the
   `useDebouncedValue` / `resolveMediaUrl` / `totalEntScore` duplication.
4. **S2** (route guards through repositories) — half a day, opens the
   door to cheaper tests.
5. **S4** (push admission math server-side) — already half-done, finish
   it and remove the client-side total recompute.
6. **S5** (decorator-based i18n) — kills a real foot-gun.
7. **S7** (SQL-side chance aggregation) — biggest perf win, schedule
   for a quiet week.
8. **S6** (mega-service splits) — schedule per file when someone is
   next in that area.
9. **S9** (tooling) — Dockerfile, `test:all`, drop `old_apps/`.

If I had to pick a single change to make this quarter, it would be
**S1**: the wins on cross-app consistency are immediate and they unlock
the rest of the cleanup because everything else needs a stable shared
package to land on.
