# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilimland is a Kazakh exam preparation platform (my-test.kz) with multiple apps in a monorepo.

## Stack

- **Monorepo**: npm workspaces + Turbo
- **Database**: PostgreSQL via Prisma ORM
- **API**: NestJS with JWT auth (passport-jwt), Redis caching, Telegraf Telegram bot
- **Web/Admin**: React 18 + Vite + Tailwind CSS
- **Shared**: TypeScript package (`@bilimland/shared`) with ENT scoring model

## Commands

```bash
npm run dev          # Start all apps (web, api, admin) via turbo
npm run build        # Build all apps via turbo
npm run lint         # Lint all apps

# Web
cd apps/web && npm run dev    # Start web dev server (port 5173)
cd apps/web && npm run build  # Build web (runs tsc -b && vite build)

# API
cd apps/api && npm run dev    # Start API (NestJS with watch mode)
cd apps/api && npm run build  # Build API
npm run db:migrate:dev  # Run Prisma migrations in dev
npm run db:migrate       # Deploy migrations (safe)
npm run db:seed         # Seed database
npm run db:generate     # Generate Prisma client

# Admin
cd apps/admin && npm run dev
```

## Architecture

### apps/web — Main frontend

- **Landing pages**: `LandingV3.tsx`, `LandingV4.tsx` in `src/components/landing/` are the primary landing page components. `LandingPage.tsx` in `src/pages/` is the older v1 landing.
- **API client** (`src/api/client.ts`): Axios instance with JWT interceptor. Token stored in localStorage, auto-refreshed on 401.
- **Landing settings** (`/public/landing-settings`): Hero carousel images and instruction video URL come from API — not hardcoded. Fetched in landing page components via `api.get('/public/landing-settings')`.
- **i18n** (`src/i18n/`): Files `ru.json`, `kk.json`, `en.json`. Landing V3 uses `landingV3.*` keys. Testimonials use `landing.testimonials` (simple: `{ quote, author }`).
- **Admission/Chance**: `AdmissionChanceWidget` in `src/components/admission/` — interactive grant estimator using `/admission/*` API endpoints.
- **Routing**: React Router v6. Protected routes check auth state.

### apps/api — Backend

- **Modules** under `src/modules/`: `settings` (landing config), `admission` (cutoffs, universities, programs, chance), `auth`, `users`, `sessions`, etc.
- **Public landing settings** (`GET /public/landing-settings`): Returns `instructionVideoUrl`, `instagramUrl`, `tiktokUrl`, `whatsappUrl`, `heroSlides[]`.
- **Admission endpoints**: `/admission/cycles`, `/admission/universities`, `/admission/programs`, `/admission/cutoffs`, `/admission/chance/*`
- **Prisma schema** (`prisma/schema.prisma`): Models for `User`, `Session`, `Attempt`, `GrantCutoff`, `University`, `Program`, `AdmissionCycle`, etc.
- **Auth**: JWT access + refresh tokens. Telegram login via `telegraf` bot.
- **Redis**: Used for caching, rate limiting, daily attempt limits.

### apps/admin — Admin panel

React + Vite + Ant Design. Used for managing landing settings, viewing user sessions, editing admission data.

### packages/shared

Contains shared TypeScript types and constants. Key file: `src/entGrantModel.ts` with `ENT_MAX`, `ENT_THRESHOLD_2026`, `passesThresholds()`, `grantTierHint()`.

## Key Patterns

- **Hero slides from API**: Landing pages fetch `heroSlides` from `/public/landing-settings`. Each slide has `desktopImageUrl`, `tabletImageUrl`, `mobileImageUrl` (modern) or a fallback `image` string (legacy).
- **ENT scoring**: 5 subjects — mathLit (max 10), readingLit (max 10), history (max 20), profile1 (max 50), profile2 (max 50) = 140 total. Шектi балл thresholds defined in `ENT_THRESHOLD_2026`.
- **Passing scores (проходные баллы)**: Fetched from `/admission/cutoffs?cycleSlug=<year>&quotaType=GRANT`. Data shape includes `universityCode`, `programId`, `minScore`, `quotaType`.
- **Testimonials on landing**: V1 landing (`LandingPage.tsx`) uses `landing.testimonials` from i18n with shape `{ quote, author }`. V3 landing was updated to use the same i18n keys.
- **Theme**: Dark/light toggle stored in localStorage (`mytest-theme`). Landing V3 uses `data-theme` attribute on `<html>`, older pages use CSS class `.dark`.
