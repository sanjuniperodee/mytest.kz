# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Bilimland is a Kazakh ENT (Единое Национальное Тестирование) exam-prep platform — my-test.kz / mytest.kz. It is a monorepo serving a Next.js web app, a Vite admin SPA, an Expo mobile app, and a Telegram Mini App, all backed by one NestJS API.

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
- **Admission/Chance**: Interactive grant estimator UI under `app/admission/page.tsx` hitting `/admission/*`.

### apps/api — Backend

- **Modules** under `src/modules/`: `settings`, `admission`, `auth`, `users`, `tests`, `telegram`, `billing`, `notifications`, `leads`, `analytics`, etc.
- **`admission` is the reference architecture**: pure domain logic in `domain/chance-cutoffs.ts`, persistence isolated in `infrastructure/admission.repository.ts`, and `admission.service.ts` as a thin orchestrator.
- **Common** (`src/common/`): `guards/` (e.g. `AdminGuard`, `PremiumGuard`, `channel-member.guard.ts`), `interceptors/` (i18n response localization), `decorators/`, `filters/`, `config/`.
- **Prisma schema** (`prisma/schema.prisma`): Models for `User`, `TestSession`, `TestAnswer`, `PaymentOrder`, `PaymentRefund`, `Lead`, `VisitEvent`, etc.
- **Redis**: Used for OTP codes caching, rate limiting, and daily attempt limits.

### packages/shared

Built TS package; `src/index.ts` re-exports everything. Key files: `entGrantModel.ts` (`ENT_MAX`, `ENT_THRESHOLD_2026`, `passesThresholds()`, `grantTierHint()`), `entQuestionScoring.ts`, `admissionCompare.ts`, `admissionApiTypes.ts`, `landingTypes.ts`.

## Key Patterns

- **ENT scoring**: 5 subjects — mathLit (max 10), readingLit (max 10), history (max 20), profile1 (max 50), profile2 (max 50) = 140 total. Use `totalEntScore()` from `@bilimland/shared` (clamps inputs); do **not** re-sum the five fields inline.
- **Passing scores (проходные баллы)**: Fetched from `/admission/cutoffs?cycleSlug=<year>&quotaType=GRANT`.
- **JWT `isAdmin` is a UI hint only**: `AdminGuard` re-reads `User.isAdmin` from the database on every request.
- **i18n on the wire**: The API returns `{ kk, ru, en }` objects; an interceptor localizes responses server-side and the client `localize()` handles the rest.
- **Hero slides / landing config**: Landing pages fetch `heroSlides` dynamically from `/public/landing-settings`. Each slide has `desktopImageUrl`, `tabletImageUrl`, `mobileImageUrl` or a legacy `image` fallback.
- **Theme**: Dark/light toggle stored in localStorage (`mytest-theme`). Web UI uses `data-theme` attribute on `<html>`, older pages use CSS class `.dark`.
