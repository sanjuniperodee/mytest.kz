# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilimland is a Kazakh ENT (Единое Национальное Тестирование) exam-prep platform — my-test.kz / mytest.kz. It's a monorepo serving a Next.js web app, a Vite admin SPA, an Expo mobile app, and a Telegram Mini App, all backed by one NestJS API.

## Stack

- **Monorepo**: npm workspaces + Turbo (`turbo.json`). ⚠️ The root `package.json` is **not checked in** — see Commands.
- **API** (`apps/api`): NestJS 11, Prisma 5 → PostgreSQL, Redis (ioredis), JWT (passport-jwt), Telegraf Telegram bot, FreedomPay billing.
- **Web** (`apps/web`): Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (Radix), SWR. Package name is `mytest-v2`. **This is the current main frontend.**
- **Admin** (`apps/admin`): Vite + React 18 + Ant Design + TanStack Query + axios.
- **Mobile** (`apps/mobile`): Expo 54 / React Native 0.81, expo-router, EAS builds.
- **Shared** (`packages/shared`): framework-agnostic TS — ENT scoring, admission DTOs, validators, i18n types. Imported as `@bilimland/shared`, must be built (`dist/`) before consumers compile.
- **`apps/old_apps/`**: the **legacy Vite web app** (the LandingV3/V4 + React Router SPA that older docs describe). Kept for reference; not in the active build.

## Commands

⚠️ **There is no root `package.json`, so root-level scripts and `npx turbo` from the repo root currently fail.** Run commands inside each workspace:

```bash
# Web (Next.js) — http://localhost:3000
cd apps/web && npm run dev        # next dev
cd apps/web && npm run build      # next build

# API (NestJS) — http://localhost:${API_PORT:-3000}, global prefix /api/v1
cd apps/api && npm run dev        # nest start --watch
cd apps/api && npm run build      # nest build  (prebuild: prisma generate + build shared)
cd apps/api && npm run lint       # eslint --fix
cd apps/api && npm run test:api   # Jest e2e (test/jest-e2e.json, --runInBand)

# Admin (Vite) — http://localhost:5173
cd apps/admin && npm run dev
cd apps/admin && npm run lint     # tsc --noEmit (typecheck-only)

# Shared — build before API/admin compile
cd packages/shared && npm run build   # tsc
cd packages/shared && npm run dev     # tsc --watch

# Mobile
cd apps/mobile && npm run start   # expo start
```

> API default port and Next dev port both default to 3000 — set `API_PORT` to avoid the collision when running both.

### Database (Prisma) — run from `apps/api`

```bash
npx prisma migrate dev            # create/apply migration in dev
npm run migrate:deploy:safe       # check-migrations-safe.ts gate, then prisma migrate deploy
npx prisma generate               # regenerate client (also runs on postinstall/prebuild)
npx prisma db seed                # full seed (prisma/seed.ts)
npx prisma studio                 # DB browser
# Topic seeders: seed:math-sauat, seed:reading-sauat,
#   seed:history-kz-ent-{kk,ru}, seed:geo-ent, seed:grant-admission
```

Postgres + Redis for local dev come from `docker-compose.yml` (`docker compose up -d`).

### E2E (Playwright, repo root)

```bash
npx playwright test               # config: playwright.config.ts
npx playwright test e2e/foo.spec.ts            # single file
npx playwright test -g "name substring"        # single test by title
```

## Architecture

### Request flow

```
Web (Next.js) / Mobile (Expo) / Admin (Vite) / Telegram Mini App
        │
        ├─ Web: browser calls same-origin "/api/v1/*" → Next route handler
        │       apps/web/app/api/v1/[...path]/route.ts  (thin proxy, no business logic)
        │       forwards to NEXT_PUBLIC_API_BASE_URL (prod: https://api.my-test.kz)
        │       apps/web/app/api/media/[...path]/route.ts proxies uploaded media
        │
        └─→ NestJS API (global prefix /api/v1) → Prisma → Postgres
                                               ↕ Redis (auth OTP codes, rate limit, throttling)
                                               ↕ Telegraf (bot + channel-membership checks)
```

All clients speak the same JSON contract. The web app's `lib/api/client.ts` uses a fetch wrapper with `BASE = "/api/v1"` so the browser stays same-origin (the Next proxy avoids CORS); debugging the API directly means hitting the Nest server, not the proxy.

### apps/web (Next.js — main frontend)

- **Routing**: App Router under `app/` — route groups `(auth)/login`, `admission/`, `dashboard/`, `exam/`, `payment/`, `paywall/`, `mobile/`, plus `sitemap.ts`/`robots.ts`. Most pages are `"use client"` and fetch via SWR.
- **API layer** (`lib/api/`): `client.ts` (fetch + `ApiError` + token refresh), `auth-context.tsx`, `swr.ts`, `i18n.ts` (`localize`/`localizeDeep`), `types.ts` (API contract types), `storage.ts`, `test-session.ts`, `analytics.ts`.
- **i18n**: `lib/i18n/ui.tsx` (UI strings) + `lib/api/i18n.ts` (localizes `{ kk, ru, en }` objects coming from the API). Kazakh/Russian/English.
- **Admission/Chance**: `app/admission/page.tsx` — interactive grant estimator hitting `/admission/*`.

### apps/api (NestJS)

- **Modules** (`src/modules/`): `admission`, `admin`, `analytics`, `auth`, `billing`, `bulk-import`, `db-snapshot`, `exams`, `leaderboard`, `leads`, `notifications`, `question-appeals`, `questions`, `settings`, `subscriptions`, `telegram`, `tests`, `users`.
- **`admission` is the reference architecture**: pure domain logic in `domain/chance-cutoffs.ts` (`resolveDisplayedCutoff`, `resolveChanceRows`), persistence isolated in `infrastructure/admission.repository.ts`, and `admission.service.ts` as a thin orchestrator. Other modules don't yet follow this layering — match it for new work in `admission`.
- **Common** (`src/common/`): `guards/` (e.g. `AdminGuard`, `channel-member.guard.ts`), `interceptors/` (i18n response localization), `decorators/`, `filters/`, `config/`.
- **Endpoints**: admission → `/admission/cycles|universities|programs|cutoffs|chance/*`; public landing config → `GET /public/landing-settings`.
- **Prisma schema**: `apps/api/prisma/schema.prisma` (`User`, `Session`, `Attempt`, `GrantCutoff`, `University`, `Program`, `AdmissionCycle`, subscriptions/entitlements, etc.).

### packages/shared

Built TS package; `src/index.ts` re-exports everything. Key files: `entGrantModel.ts` (`ENT_MAX`, `ENT_THRESHOLD_2026`, `ENT_TOTAL_MAX`, `totalEntScore()`, `passesThresholds()`, `grantTierHint()`), `entQuestionScoring.ts`, `admissionCompare.ts`, `admissionApiTypes.ts`, `landingTypes.ts`, `validators/`, `constants/`.

## Key Patterns

- **ENT scoring** = 5 subjects: mathLit (max 10), readingLit (max 10), history (max 20), profile1 (max 50), profile2 (max 50) → 140 total. Use `totalEntScore()` from `@bilimland/shared` (it clamps inputs); do **not** re-sum the five fields inline — that's a recurring duplication/bug source across clients. Шектік балл thresholds live in `ENT_THRESHOLD_2026`.
- **Passing scores (проходные баллы)**: `GET /admission/cutoffs?cycleSlug=<year>&quotaType=GRANT` → rows with `universityCode`, `programId`, `minScore`, `quotaType`.
- **JWT `isAdmin` is a UI hint only** — `AdminGuard` re-reads `User.isAdmin` from the DB on every request, so privilege changes take effect immediately. Never treat the JWT claim as the security boundary.
- **i18n on the wire**: the API returns `{ kk, ru, en }` objects; an interceptor localizes responses server-side and the client `localize()` handles the rest. The interceptor skips some subtrees (e.g. `/exams/`, bulk endpoints) via URL heuristics — be careful adding routes that should/shouldn't be localized.
- **Hero slides / landing config from API**: landing pages fetch `heroSlides`, `instructionVideoUrl`, social URLs from `/public/landing-settings` — not hardcoded. Slides carry `desktopImageUrl`/`tabletImageUrl`/`mobileImageUrl` (or a legacy `image` fallback).
- **Media URLs** resolve differently per app (web proxies via `/api/media`, mobile/admin use the API/files origin) — check the app's client before assuming a `/uploads/...` path renders identically everywhere.
- **Channel membership**: several auth/users paths reconcile Telegram channel membership via the Telegraf bot; the check is duplicated across call sites — keep them consistent if you touch one.

## Notes

- `AGENTS.md` is a parallel (Codex) instruction file and is currently **out of date** (still describes the old Vite web app). Update it alongside CLAUDE.md if you change project facts.
- `docs/architecture-review.md` is a detailed senior-engineer refactoring review (duplication, mega-services, perf hot paths). Useful context for larger refactors.
- Dev/test auth shortcuts (fixed OTP) exist in `auth.service.ts` — verify they're disabled in production before relying on auth behavior.
