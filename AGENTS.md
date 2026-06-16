# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Bilimland is a Kazakh exam preparation platform (my-test.kz) with multiple apps in a monorepo.

## Stack

- **Monorepo**: app-level npm packages + Turbo config
- **Database**: PostgreSQL via Prisma ORM
- **API**: NestJS with JWT auth (passport-jwt), Redis caching, Telegraf Telegram bot
- **Web**: Next.js + React + Tailwind CSS
- **Admin**: React 18 + Vite + Ant Design
- **Shared**: TypeScript package (`@bilimland/shared`) with ENT scoring model

## Commands

```bash
npm run dev          # Start all apps (web, api, admin) via turbo
npm run build        # Build all apps via turbo
npm run lint         # Lint all apps

# Web
cd apps/web && npm run dev    # Start Next.js web dev server (default port 3000)
cd apps/web && npm run build  # Build web (Next.js)

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

- **Framework**: Next.js App Router under `app/`, shared UI under `components/`, client API helpers under `lib/api/`.
- **API proxy**: `app/api/v1/[...path]/route.ts` forwards browser requests to the Nest API.
- **Media proxy**: `app/api/media/[...path]/route.ts` resolves uploaded media from the API origin.
- **Auth client**: `lib/api/client.ts` and `lib/api/storage.ts` currently manage bearer tokens and refresh calls.
- **Admission/Chance**: admission UI uses `/admission/*` API endpoints.

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
