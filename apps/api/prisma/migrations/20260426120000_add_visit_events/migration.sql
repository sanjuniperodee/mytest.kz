<<<<<<< HEAD
-- CreateVisitEventAndFunnelStepAndVisitId migration
-- Add VisitEvent, FunnelStep models and visitId on TestSession

BEGIN;

-- Create visit_events table
CREATE TABLE "visit_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
=======
-- Add VisitEvent, FunnelStep models and visitId on TestSession

-- Create visit_events table
CREATE TABLE "visit_events" (
    "id" UUID NOT NULL,
>>>>>>> 85f3efa5421a8e45260cf314fdf12ccd16b9c6a5
    "visitor_id" VARCHAR(64) NOT NULL,
    "user_id" UUID,
    "source" VARCHAR(32),
    "medium" VARCHAR(32),
    "campaign" VARCHAR(64),
    "referrer" VARCHAR(500),
    "landing_path" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

<<<<<<< HEAD
-- Create index on visitor_id + created_at
CREATE INDEX "visit_events_visitor_id_created_at_idx" ON "visit_events"("visitor_id", "created_at");
-- Create index on user_id + created_at
CREATE INDEX "visit_events_user_id_created_at_idx" ON "visit_events"("user_id", "created_at");
-- Create index on created_at
CREATE INDEX "visit_events_created_at_idx" ON "visit_events"("created_at");

-- Create funnel_steps table
CREATE TABLE "funnel_steps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
=======
CREATE INDEX "visit_events_visitor_id_created_at_idx" ON "visit_events"("visitor_id", "created_at");
CREATE INDEX "visit_events_user_id_created_at_idx" ON "visit_events"("user_id", "created_at");
CREATE INDEX "visit_events_created_at_idx" ON "visit_events"("created_at");
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Create funnel_steps table
CREATE TABLE "funnel_steps" (
    "id" UUID NOT NULL,
>>>>>>> 85f3efa5421a8e45260cf314fdf12ccd16b9c6a5
    "visit_id" UUID NOT NULL,
    "step" VARCHAR(32) NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "metadata" JSONB,
    "session_id" UUID,
    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);

<<<<<<< HEAD
-- Create index on visit_id
CREATE INDEX "funnel_steps_visit_id_idx" ON "funnel_steps"("visit_id");
-- Create index on step + timestamp
CREATE INDEX "funnel_steps_step_timestamp_idx" ON "funnel_steps"("step", "timestamp");

-- Add visit_id column to test_sessions
ALTER TABLE "test_sessions" ADD COLUMN "visit_id" UUID;
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Create index on visit_id in test_sessions
CREATE INDEX "test_sessions_visit_id_idx" ON "test_sessions"("visit_id");

-- Add relation to users
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add relation to funnel_steps -> visit_events
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add relation to funnel_steps -> test_sessions
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

COMMIT;
=======
CREATE INDEX "funnel_steps_visit_id_idx" ON "funnel_steps"("visit_id");
CREATE INDEX "funnel_steps_step_timestamp_idx" ON "funnel_steps"("step", "timestamp");
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add visit_id to test_sessions
ALTER TABLE "test_sessions" ADD COLUMN "visit_id" UUID;
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "test_sessions_visit_id_idx" ON "test_sessions"("visit_id");
>>>>>>> 85f3efa5421a8e45260cf314fdf12ccd16b9c6a5
