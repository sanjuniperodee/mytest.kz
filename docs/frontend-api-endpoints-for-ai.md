# Bilimland Frontend API Endpoints

This document summarizes the backend endpoints currently used by the Bilimland frontend apps:

- `apps/web` - main user app
- `apps/admin` - admin panel

Use this as a synchronization guide for an AI agent integrating with the backend.

## Base URL

All frontend API calls use the `/api/v1` prefix.

Development:

```txt
/api/v1
```

The Vite dev server proxies this to the NestJS API on `http://localhost:3000`.

Production:

```txt
https://api.my-test.kz/api/v1
```

If `VITE_API_URL` is set, it overrides the derived URL.

## Authentication

Most protected endpoints require:

```txt
Authorization: Bearer <accessToken>
```

The web app stores tokens in:

```txt
accessToken
refreshToken
```

The admin app stores tokens in:

```txt
admin_accessToken
admin_refreshToken
```

Both apps refresh automatically on `401` using `/auth/refresh`.

## Auth Endpoints

### Telegram Login

```http
POST /auth/telegram
```

Body:

```json
{
  "initData": "telegram-webapp-init-data"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {}
}
```

### Google Login

```http
POST /auth/google
```

Body:

```json
{
  "credential": "google-id-token"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {}
}
```

### Request Phone Code

```http
POST /auth/web/request-code
```

Body:

```json
{
  "phone": "+77000000000"
}
```

### Verify Phone Code

```http
POST /auth/web/verify-code
```

Body:

```json
{
  "phone": "+77000000000",
  "code": "123456"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {}
}
```

### Refresh Token

```http
POST /auth/refresh
```

Body:

```json
{
  "refreshToken": "jwt"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

## Public Landing Endpoints

### Landing Runtime Settings

```http
GET /public/landing-settings
```

Response shape:

```json
{
  "instructionVideoUrl": "https://youtu.be/...",
  "instagramUrl": "https://instagram.com/...",
  "tiktokUrl": "https://www.tiktok.com/...",
  "whatsappUrl": "https://wa.me/...",
  "heroSlides": [
    {
      "desktopImageUrl": "/uploads/...",
      "tabletImageUrl": "/uploads/...",
      "mobileImageUrl": "/uploads/...",
      "image": "/uploads/..."
    }
  ]
}
```

### Create Lead

```http
POST /leads
```

Used by landing lead forms.

Body: lead form payload from the landing page.

The backend also records IP and user agent from the request.

### Record Visit

```http
POST /analytics/visit
```

Body:

```json
{
  "visitorId": "optional-client-id",
  "source": "utm_source",
  "medium": "utm_medium",
  "campaign": "utm_campaign",
  "referrer": "https://referrer.example",
  "landingPath": "/"
}
```

Response: visit tracking result.

Side effect: sets an httpOnly cookie:

```txt
blm_vid
```

## User Profile

Requires JWT.

### Current User

```http
GET /users/me
```

### Update Current User

```http
PATCH /users/me
```

Body:

```json
{
  "preferredLanguage": "ru",
  "timezone": "Asia/Almaty",
  "avatarUrl": "/uploads/avatar.png"
}
```

Fields are optional. `avatarUrl` may be `null`.

### Current User Stats

```http
GET /users/me/stats
```

## Exams Catalog

Requires JWT.

### Exam Types

```http
GET /exams/types
```

### Exam Subjects

```http
GET /exams/types/:examTypeId/subjects
```

### Test Templates

```http
GET /exams/types/:examTypeId/templates
```

## Tests And Sessions

Requires JWT and Telegram channel membership guard.

### Start Test

```http
POST /tests/start
```

Body:

```json
{
  "templateId": "uuid",
  "language": "ru",
  "profileSubjectIds": ["uuid"],
  "entScope": "full"
}
```

`entScope` is only for ENT tests:

```txt
mandatory | profile | full
```

### List Sessions

```http
GET /tests/sessions
```

Query:

```json
{
  "page": 1,
  "limit": 10,
  "examTypeId": "uuid",
  "status": "in_progress"
}
```

Valid `status` values:

```txt
in_progress | completed | timed_out | abandoned
```

### Get Session

```http
GET /tests/sessions/:sessionId
```

### Submit Answer

```http
POST /tests/sessions/:sessionId/answer
```

Body:

```json
{
  "questionId": "uuid",
  "selectedIds": ["answer-option-id"]
}
```

Response includes current server timer sync:

```json
{
  "id": "answer-id",
  "selectedIds": ["answer-option-id"],
  "serverTimeRemaining": 1234
}
```

`serverTimeRemaining` can be `null`.

### Finish Test

```http
POST /tests/sessions/:sessionId/finish
```

### Review Session

```http
GET /tests/sessions/:sessionId/review
```

### Get Question Explanation

```http
GET /tests/sessions/:sessionId/review/:questionId/explanation
```

Requires JWT, channel membership, and premium access.

Response shape:

```json
{
  "questionId": "uuid",
  "explanation": {},
  "imageUrls": []
}
```

## Mistakes Practice

Requires JWT and Telegram channel membership guard.

### Mistakes Summary

```http
GET /tests/mistakes/summary
```

### Start Mistakes Practice

```http
POST /tests/mistakes/practice
```

Body:

```json
{
  "language": "ru",
  "examTypeId": "uuid",
  "limit": 20,
  "durationMins": 30
}
```

Optional fields:

```txt
examTypeId
limit
durationMins
```

## Leaderboard

Requires JWT and Telegram channel membership guard.

### ENT Leaderboard

```http
GET /leaderboard/ent
```

Query:

```json
{
  "limit": 50
}
```

## Billing

### Billing Plans

```http
GET /billing/plans
```

Public endpoint.

### Create Checkout

```http
POST /billing/checkout
```

Requires JWT.

Body:

```json
{
  "planId": "plan-id"
}
```

Response:

```json
{
  "paymentUrl": "https://...",
  "orderId": "..."
}
```

### Payment Callback

```http
POST /billing/freedompay/callback
```

Used by FreedomPay, not by frontend directly.

### Get Order

```http
GET /billing/orders/:orderId
```

Requires JWT. Present on backend, not currently used by the main frontend hooks.

## Admission And Grant Estimator

These endpoints are public and throttled.

ENT score fields:

```txt
mathLit: 0-10
readingLit: 0-10
history: 0-20
profile1: 0-50
profile2: 0-50
total: 0-140
```

Quota types:

```txt
GRANT | RURAL
```

### Admission Cycles

```http
GET /admission/cycles
```

Response item:

```json
{
  "id": "uuid",
  "slug": "2025-2026",
  "sortOrder": 1
}
```

### Universities

```http
GET /admission/universities
```

Response item:

```json
{
  "code": 123,
  "name": "University name",
  "shortName": "Short name"
}
```

### Programs

```http
GET /admission/programs
```

Query:

```json
{
  "code": "B057",
  "q": "search text",
  "take": 20
}
```

Response item:

```json
{
  "id": "uuid",
  "code": "B057",
  "profileVariant": 1,
  "name": "Program name",
  "profileSubjects": "math-physics",
  "profileShortLabel": "Math + Physics"
}
```

### Cutoffs

```http
GET /admission/cutoffs
```

Query:

```json
{
  "cycleSlug": "2025-2026",
  "universityCode": 123,
  "programId": "uuid",
  "quotaType": "GRANT"
}
```

Required:

```txt
cycleSlug
universityCode
```

Response item:

```json
{
  "cycleSlug": "2025-2026",
  "universityCode": 123,
  "universityName": "University name",
  "universityShortName": "Short name",
  "programId": "uuid",
  "programCode": "B057",
  "programName": "Program name",
  "profileVariant": 1,
  "profileSubjects": "math-physics",
  "quotaType": "GRANT",
  "minScore": 100
}
```

### Compare Score With Cutoff

```http
GET /admission/compare
```

Query:

```json
{
  "cycleSlug": "2025-2026",
  "universityCode": 123,
  "programId": "uuid",
  "quotaType": "GRANT",
  "mathLit": 8,
  "readingLit": 8,
  "history": 15,
  "profile1": 40,
  "profile2": 42
}
```

Response:

```json
{
  "total": 113,
  "passesEntThresholds": true,
  "cutoff": 100,
  "hasCutoff": true,
  "gapToCutoff": 13
}
```

### Chance Profile Subjects

```http
GET /admission/chance/profile-subjects
```

Query:

```json
{
  "cycleSlug": "2025-2026",
  "quotaType": "GRANT",
  "universityCode": 123
}
```

Required:

```txt
cycleSlug
quotaType
```

Response item:

```json
{
  "value": "math-physics",
  "label": "Math + Physics"
}
```

### Chance Programs

```http
GET /admission/chance/programs
```

Query:

```json
{
  "cycleSlug": "2025-2026",
  "quotaType": "GRANT",
  "profileSubjects": "math-physics",
  "universityCode": 123,
  "programId": "uuid",
  "mathLit": 8,
  "readingLit": 8,
  "history": 15,
  "profile1": 40,
  "profile2": 42
}
```

Required:

```txt
cycleSlug
quotaType
profileSubjects
mathLit
readingLit
history
profile1
profile2
```

Response item:

```json
{
  "cycleSlug": "2025-2026",
  "programId": "uuid",
  "programCode": "B057",
  "programName": "Program name",
  "profileSubjects": "math-physics",
  "profileVariant": 1,
  "displayedQuotaType": "GRANT",
  "displayedMinScore": 100,
  "universityCount": 5,
  "isPass": true,
  "total": 113,
  "gapToCutoff": 13
}
```

### Chance Universities

```http
GET /admission/chance/universities
```

Query:

```json
{
  "cycleSlug": "2025-2026",
  "quotaType": "GRANT",
  "programId": "uuid",
  "universityCode": 123,
  "mathLit": 8,
  "readingLit": 8,
  "history": 15,
  "profile1": 40,
  "profile2": 42
}
```

Required:

```txt
cycleSlug
quotaType
programId
mathLit
readingLit
history
profile1
profile2
```

Response item:

```json
{
  "cycleSlug": "2025-2026",
  "universityCode": 123,
  "universityName": "University name",
  "universityShortName": "Short name",
  "programId": "uuid",
  "programCode": "B057",
  "programName": "Program name",
  "profileSubjects": "math-physics",
  "profileVariant": 1,
  "displayedQuotaType": "GRANT",
  "displayedMinScore": 100,
  "isPass": true,
  "total": 113,
  "gapToCutoff": 13
}
```

## Admin Endpoints

All `/admin/*` endpoints require JWT and admin privileges.

## Admin Users

### List Users

```http
GET /admin/users
```

Query:

```json
{
  "search": "phone or username",
  "page": 1,
  "limit": 20
}
```

### User Detail

```http
GET /admin/users/:id
```

### Update User

```http
PATCH /admin/users/:id
```

Body:

```json
{
  "isAdmin": true
}
```

## Admin Analytics

### Overview

```http
GET /admin/analytics/overview
```

### ENT Trials

```http
GET /admin/analytics/ent-trials
```

### Funnel

```http
GET /admin/analytics/funnel
```

Query:

```json
{
  "from": "2026-05-01",
  "to": "2026-05-06",
  "examTypeId": "uuid"
}
```

### Visitors

```http
GET /admin/analytics/visitors
```

Query:

```json
{
  "page": 1,
  "limit": 20,
  "from": "2026-05-01",
  "to": "2026-05-06",
  "search": "query",
  "examTypeId": "uuid",
  "step": "registered"
}
```

### Test Takers

```http
GET /admin/analytics/test-takers
```

Query:

```json
{
  "page": 1,
  "limit": 20,
  "from": "2026-05-01",
  "to": "2026-05-06",
  "examTypeId": "uuid"
}
```

## Admin Landing Settings

### Get Landing Settings

```http
GET /admin/settings/landing
```

### Update Landing Settings

```http
PATCH /admin/settings/landing
```

Body:

```json
{
  "instructionVideoUrl": "https://youtu.be/...",
  "instagramUrl": "https://instagram.com/...",
  "tiktokUrl": "https://www.tiktok.com/...",
  "whatsappUrl": "https://wa.me/...",
  "heroSlides": []
}
```

### Upload Landing Image

```http
POST /admin/settings/landing/images
Content-Type: multipart/form-data
```

Form field:

```txt
file
```

Response:

```json
{
  "url": "/uploads/landing-carousel/file.webp"
}
```

Limits:

```txt
max size: 8 MB
allowed: jpeg, jpg, png, gif, webp
```

## Admin Questions

### List Questions

```http
GET /admin/questions
```

Query:

```json
{
  "id": "uuid",
  "examTypeId": "uuid",
  "subjectId": "uuid",
  "topicId": "uuid",
  "difficulty": 2,
  "hasExplanation": true,
  "contentLocale": "ru",
  "page": 1,
  "limit": 20
}
```

Valid `contentLocale`:

```txt
kk | ru | unset
```

### Similar Questions

```http
GET /admin/questions/similar
```

Query:

```json
{
  "examTypeId": "uuid",
  "subjectId": "uuid",
  "locale": "ru",
  "text": "question text",
  "excludeId": "uuid",
  "threshold": 0.75,
  "limit": 10,
  "searchIn": "all"
}
```

Valid `searchIn`:

```txt
topic | stem | all
```

### Create Question

```http
POST /admin/questions
```

Body: question payload.

### Update Question

```http
PATCH /admin/questions/:id
```

Body: partial or full question payload.

### Delete Question

```http
DELETE /admin/questions/:id
```

### Upload Question Image

```http
POST /admin/questions/images
Content-Type: multipart/form-data
```

Form field:

```txt
file
```

Response:

```json
{
  "url": "/uploads/question-images/file.webp"
}
```

Limits:

```txt
max size: 5 MB
allowed: jpeg, jpg, png, gif, webp
```

## Admin Exam Catalog

### Full Catalog

```http
GET /admin/exams/catalog
```

Query:

```json
{
  "includeInactive": true
}
```

### Exam Types

```http
POST /admin/exams/types
PATCH /admin/exams/types/:id
DELETE /admin/exams/types/:id
```

### Subjects

```http
POST /admin/exams/types/:examTypeId/subjects
PATCH /admin/exams/subjects/:id
DELETE /admin/exams/subjects/:id
```

### Topics

```http
POST /admin/exams/subjects/:subjectId/topics
PATCH /admin/exams/topics/:id
DELETE /admin/exams/topics/:id
```

### Templates

```http
GET /admin/exams/types/:examTypeId/templates
POST /admin/exams/types/:examTypeId/templates
PATCH /admin/exams/templates/:id
PUT /admin/exams/templates/:id/sections
DELETE /admin/exams/templates/:id
```

Template list query:

```json
{
  "includeInactive": true
}
```

## Admin Subscriptions

### Plan Templates

```http
GET /admin/subscriptions/plan-templates
POST /admin/subscriptions/plan-templates
PATCH /admin/subscriptions/plan-templates/:id
```

Create body:

```json
{
  "code": "ent_monthly",
  "name": "ENT Monthly",
  "description": "optional",
  "isPremium": true,
  "durationDays": 30,
  "totalAttemptsLimit": null,
  "dailyAttemptsLimit": null,
  "timezoneMode": "user",
  "metadata": {},
  "rules": [
    {
      "examTypeId": "uuid",
      "totalAttemptsLimit": null,
      "dailyAttemptsLimit": null,
      "isUnlimited": true,
      "sortOrder": 1
    }
  ]
}
```

Update body may include the same editable fields plus:

```json
{
  "isActive": true,
  "replaceRules": []
}
```

### Grant Subscription

```http
POST /admin/subscriptions
```

Body:

```json
{
  "userId": "uuid",
  "planType": "premium",
  "examTypeId": "uuid",
  "startsAt": "2026-05-06T00:00:00.000Z",
  "expiresAt": "2026-06-06T00:00:00.000Z",
  "paymentNote": "manual"
}
```

### Revoke Subscription

```http
DELETE /admin/subscriptions/:id
```

### Apply Plan Template

```http
POST /admin/subscriptions/apply-plan-template
```

Body:

```json
{
  "userId": "uuid",
  "planTemplateId": "uuid",
  "windowStartsAt": "2026-05-06T00:00:00.000Z",
  "windowEndsAt": "2026-06-06T00:00:00.000Z",
  "paymentNote": "manual"
}
```

### User Entitlements

```http
GET /admin/subscriptions/users/:userId/entitlements
```

### Grant Entitlement

```http
POST /admin/subscriptions/entitlements
```

Body:

```json
{
  "userId": "uuid",
  "examTypeId": "uuid",
  "tier": "premium",
  "status": "active",
  "sourceType": "manual",
  "sourceRef": "optional",
  "planTemplateId": "uuid",
  "subscriptionId": "uuid",
  "totalAttemptsLimit": null,
  "dailyAttemptsLimit": null,
  "usedAttemptsTotal": 0,
  "timezone": "Asia/Almaty",
  "windowStartsAt": "2026-05-06T00:00:00.000Z",
  "windowEndsAt": "2026-06-06T00:00:00.000Z",
  "metadata": {}
}
```

### Update Entitlement

```http
PATCH /admin/subscriptions/entitlements/:id
```

Body:

```json
{
  "status": "active",
  "tier": "premium",
  "totalAttemptsLimit": null,
  "dailyAttemptsLimit": null,
  "timezone": "Asia/Almaty",
  "windowStartsAt": "2026-05-06T00:00:00.000Z",
  "windowEndsAt": "2026-06-06T00:00:00.000Z",
  "nextAllowedAt": null,
  "metadata": {}
}
```

### Adjust Entitlement Attempts

```http
POST /admin/subscriptions/entitlements/:id/adjust-attempts
```

Body:

```json
{
  "delta": 1,
  "reasonCode": "manual_adjustment"
}
```

## Quick Integration Checklist

- Prefix every API route with `/api/v1`.
- Send JWT as `Authorization: Bearer <accessToken>` for protected routes.
- On `401`, call `POST /auth/refresh` with `refreshToken`, then retry once.
- Use `withCredentials: true` for the web app so `blm_vid` analytics cookie works.
- Public landing and admission routes do not need JWT.
- `/tests/*` and `/leaderboard/*` require both JWT and Telegram channel membership.
- `/tests/.../explanation` additionally requires premium access.
- `/admin/*` routes require JWT and admin privileges.
- Uploaded media URLs are returned as `/uploads/...` paths and should be resolved against the API origin, not `/api/v1`.
