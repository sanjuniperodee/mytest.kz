CREATE TABLE "test_feedback" (
  "session_id" UUID PRIMARY KEY REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rating" INTEGER CHECK ("rating" BETWEEN 1 AND 5),
  "blocker" VARCHAR(32), "intent" VARCHAR(20), "comment" VARCHAR(1000),
  "locale" VARCHAR(2) NOT NULL DEFAULT 'ru',
  "shown_at" TIMESTAMPTZ, "skipped_at" TIMESTAMPTZ, "submitted_at" TIMESTAMPTZ
);
CREATE INDEX "test_feedback_submitted_at_idx" ON "test_feedback"("submitted_at");
CREATE INDEX "test_feedback_shown_at_idx" ON "test_feedback"("shown_at");
