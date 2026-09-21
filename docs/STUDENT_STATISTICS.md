# Student statistics

`GET /api/v1/users/me/statistics` is a read-only, JWT-protected report. It does
not consume attempts or AI quota, and needs no database migration. Existing
`/me/stats` and `/me/ent-history` remain unchanged for mobile and dashboard clients.

## Contract

- `period`: `30`, `90` (default), `all`; rolling days, using `finishedAt`.
- `format`: `exam` (default), `practice`.
- `examTypeId`: optional UUID. Omission includes all exams.
- `page`: integer 1–100000; history uses ten rows, clamps to the last page.
- Unknown or malformed query parameters return 400. User scope always comes
  from the authenticated request, never from a query parameter.

The response includes exam options, the normalized filter, summary, last 30
scored attempts chronologically, paged history, and subject answer accuracy.
All measurements use the same session IDs; pagination does not alter aggregates.

## Definitions

- Only `completed` and `timed_out` sessions with a finish timestamp are included.
- `metadata.kind=remediation` is practice for every exam. Full ENT requires the
  shared configured question/point counts and no contradictory `entScope`.
  Partial ENT is practice. Other non-remediation exams count as exam attempts.
- Percentage prefers persisted `rawScore / maxScore`; a legacy stored percentage
  is the fallback. Missing grades stay null; genuine zero remains zero.
- Average is the arithmetic mean of graded attempt percentages, not pooled
  raw points. Best is the highest percentage (newest wins ties).
- Delta is in percentage points between the immediately preceding two selected
  attempts, only when exam, format, maximum, question count, scope, profile pair
  and section composition match. Unknown ENT profile composition suppresses it.
- Subject accuracy is fully correct / graded answer records, including graded
  unanswered questions. Partial-credit answers are not fully correct. Repeated
  questions in different attempts count again. This is not an ENT score and not
  the user's current open-mistake count. Records removed from the question bank
  cannot contribute; old session scores are never recomputed.
- Suggested focus uses the lowest historical accuracy below 80% among subjects
  with at least ten graded answers; the link leads to current mistakes, which
  may already have been corrected. This is not a readiness or admission forecast.
- Chart axes are fixed to 0–100%. Mixed subject sets or exams are explicitly
  qualified in UI copy. Dates use `Asia/Almaty`; filters persist in the URL.

## Boundaries and checks

Pure calculations live in `users/domain/statistics.ts`, persistence in
`users/infrastructure/statistics.repository.ts`, orchestration in
`statistics.service.ts`, and validation/auth in `statistics.controller.ts`.
Subject aggregation executes in PostgreSQL; question content/options are not
fetched. No production writes are needed to verify the report.

```sh
npm --prefix apps/api run test:api -- --runTestsByPath test/statistics.http.spec.ts test/user-stats-activity.http.spec.ts test/ent-consistency.http.spec.ts
npm --prefix apps/api run build
npm --prefix apps/web run build
npm --prefix apps/web run start -- --port 4320
node apps/api/test/statistics-browser.cjs
```

Browser fixtures cover RU/KK, 320/390/1280px, populated/single/empty/error/unscored
states, filter reset/persistence, pagination, links and dark mode. HTTP tests
exercise the controller with mocked authentication/persistence; they are not a
production DB or live-user end-to-end check.

Release web and API together; back up both builds first. Verify the published
stats bundle and authenticated report after release. An unauthenticated 401 only
proves routing/auth, not the correctness of real report data.
