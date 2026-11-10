# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Bilimland is a Kazakh ENT (Единое Национальное Тестирование) exam-prep platform — my-test.kz (note: mytest.kz without the hyphen is an unrelated site, Miras Academy). It is a monorepo serving a Next.js web app, a Vite admin SPA, an Expo mobile app, and a Telegram Mini App, all backed by one NestJS API.

## Stack

- **Monorepo**: npm workspaces + Turbo (`turbo.json`).
- **API** (`apps/api`): NestJS 11, Prisma 5 → PostgreSQL, Redis (ioredis), JWT (passport-jwt), Telegraf Telegram bot, FreedomPay billing.
- **Web** (`apps/web`): Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (Radix), SWR. Package name is `mytest-v2`. **This is the current main frontend.**
- **Admin** (`apps/admin`): Vite + React 18 + Ant Design + TanStack Query + axios.
- **Mobile** (`apps/mobile`): Expo 54 / React Native 0.81, expo-router, EAS builds.
- **Shared** (`packages/shared`): framework-agnostic TS — ENT scoring, admission DTOs, validators, i18n types. Imported as `@bilimland/shared`, must be built (`dist/`) before consumers compile.
- **`apps/old_apps/`**: the **legacy Vite web app** (the LandingV3/V4 + React Router SPA that older docs describe). Kept for reference; not in the active build.

## Commands

Commands can be run from the root workspace or inside individual directories:

```bash
# Start all apps via turbo
npm run dev

# Build all apps
npm run build

# Lint all apps
npm run lint

# Web (Next.js) — http://localhost:3000
cd apps/web && npm run dev        # next dev
cd apps/web && npm run build      # next build

# API (NestJS) — http://localhost:${API_PORT:-3000}, global prefix /api/v1
cd apps/api && npm run dev        # nest start --watch
cd apps/api && npm run build      # nest build (prebuild: prisma generate + build shared)
cd apps/api && npm run test:api   # Jest e2e (test/jest-e2e.json, --runInBand)

# Admin (Vite) — http://localhost:5173
cd apps/admin && npm run dev

# Shared — build before API/admin compile
cd packages/shared && npm run build   # tsc
cd packages/shared && npm run dev     # tsc --watch

# Mobile
cd apps/mobile && npm run start   # expo start
```

### Database (Prisma) — run from `apps/api` or root scripts

```bash
npm run db:migrate:dev            # cd apps/api && npx prisma migrate dev
npm run db:migrate                # cd apps/api && npm run migrate:deploy:safe
npm run db:generate               # cd apps/api && npx prisma generate
npm run db:seed                   # cd apps/api && npx prisma db seed
```

## Architecture

### apps/web — Main frontend

- **Framework**: Next.js App Router under `app/`, shared UI under `components/`, client API helpers under `lib/api/`.
- **API proxy**: `app/api/v1/[...path]/route.ts` forwards browser requests to the Nest API (thin proxy to avoid CORS).
- **Media proxy**: `app/api/media/[...path]/route.ts` resolves uploaded media from the API origin.
- **Auth client**: `lib/api/client.ts` (fetch + `ApiError` + token refresh) and `lib/api/storage.ts` manage JWT tokens and silent refresh calls.
- **Admission/Chance**: Interactive grant estimator UI under `app/admission/page.tsx` hitting `/admission/*`. Cutoff data (cycles 2023–2026) comes from the official МНВО grant-holder lists — see `apps/api/prisma/data/grant-admission/README.md`.

### apps/api — Backend

- **Modules** under `src/modules/`: `settings`, `admission`, `auth`, `users`, `tests`, `telegram`, `billing`, `notifications`, `leads`, `analytics`, etc.
- **Monetization** (tariffs, free daily ENT limit, premium features, AdSense) is one admin-edited config — see the "Monetization" bullets in `CLAUDE.md`; `packages/shared/src/monetization.ts` + `apps/api/src/modules/subscriptions/monetization.service.ts`. No hardcoded plan list.
- **Parent pays by link** (`/pay/<token>`, `apps/api/src/modules/billing/parent-pay/`) and the Kaspi order lifetime rules — see the bullets of the same name in `CLAUDE.md`. Never share the 5-minute Kaspi QR link with a parent.
- **`admission` is the reference architecture**: pure domain logic in `domain/chance-cutoffs.ts`, persistence isolated in `infrastructure/admission.repository.ts`, and `admission.service.ts` as a thin orchestrator.
- **Common** (`src/common/`): `guards/` (e.g. `AdminGuard`, `PremiumGuard`, `channel-member.guard.ts`), `interceptors/` (i18n response localization), `decorators/`, `filters/`, `config/`.
- **Prisma schema** (`prisma/schema.prisma`): Models for `User`, `TestSession`, `TestAnswer`, `PaymentOrder`, `PaymentRefund`, `Lead`, `VisitEvent`, etc.
- **Redis**: Used for OTP codes caching, rate limiting, and daily attempt limits.

### packages/shared

Built TS package; `src/index.ts` re-exports everything. Key files: `entGrantModel.ts` (`ENT_MAX`, `ENT_THRESHOLD_2026`, `passesThresholds()`, `grantTierHint()`), `entQuestionScoring.ts`, `admissionCompare.ts`, `admissionApiTypes.ts`, `landingTypes.ts`.

## Key Patterns

- **ENT scoring**: 5 subjects — mathLit (max 10), readingLit (max 10), history (max 20), profile1 (max 50), profile2 (max 50) = 140 total. Use `totalEntScore()` from `@bilimland/shared` (clamps inputs); do **not** re-sum the five fields inline.
- **Express ENT** (`entScope: 'express'`, `ENT_CONFIG.express`): 32 single-choice questions, ~50 min, 1 point each; the review returns `entEstimate { score, max: 140 }`. Not a full ENT result — leaderboard / profile stats / goal projection only count 120-question, 140-point sessions.
- **Passing scores (проходные баллы)**: Fetched from `/admission/cutoffs?cycleSlug=<year>&quotaType=GRANT`.
- **JWT `isAdmin` is a UI hint only**: `AdminGuard` re-reads `User.isAdmin` from the database on every request.
- **Email ownership is proven only by Google sign-in**: accounts left by the closed email/password signup (`passwordHash` set or `emailVerified = false`) are taken back on the owner's first Google sign-in — same user id, but password, sessions, Telegram link, push subscriptions and parent-report link are dropped. See the matching bullet in `CLAUDE.md` and `hasUnprovenEmailAccess` (`apps/api/src/common/email-ownership.ts`).
- **Lifecycle notifications**: push / Telegram / email, one channel per campaign per user — see the "Lifecycle notifications" and "Telegram connect" bullets in `CLAUDE.md`. Accounts with `telegram_linked_at` are exempt from the Telegram channel gate (`isChannelGateExempt`).
- **i18n on the wire**: The API returns `{ kk, ru, en }` objects; an interceptor localizes responses server-side and the client `localize()` handles the rest.
- **Hero slides / landing config**: Landing pages fetch `heroSlides` dynamically from `/public/landing-settings`. Each slide has `desktopImageUrl`, `tabletImageUrl`, `mobileImageUrl` or a legacy `image` fallback.
- **Theme**: Dark/light toggle stored in localStorage (`mytest-theme`). Web UI uses `data-theme` attribute on `<html>`, older pages use CSS class `.dark`.
- **Parent report** (`/progress/<token>`, «Отправить отчёт родителям»): the student shares a private link from the dashboard card / result page (`components/parent-report/send-to-parent.tsx`); the parent sees aggregates only (first name, last 8 ENT attempts, full-ENT best/latest/change, 7-day count, top-3 lost-point subjects of the latest full ENT, goal gap, paid yes/no). API module `parent-report` (admission-style layering): `POST|GET|DELETE /users/me/parent-report-link`, public `GET /public/parent-report/:token` (throttled, 60 s Redis cache). Token = HMAC (key `PARENT_REPORT_SECRET` or `JWT_SECRET`, purpose-separated) over user id + a random per-user version kept in Redis `parent-report:link:<userId>`; revoke = delete the key (fails closed if Redis is wiped). «Full ENT» = `statisticsFormat(...) === 'exam'` (120 questions, 140 points, `entScope` full) — never mix partial/remediation sessions into those figures. Analytics paths strip the token (`analyticsPath`).
