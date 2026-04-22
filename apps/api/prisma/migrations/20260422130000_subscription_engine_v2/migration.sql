-- Subscription engine v2: templates, entitlements, usage ledger, timezone support

-- Enums
CREATE TYPE "EntitlementTier" AS ENUM ('free', 'trial', 'paid', 'admin');
CREATE TYPE "EntitlementStatus" AS ENUM ('active', 'exhausted', 'revoked', 'expired');
CREATE TYPE "EntitlementSourceType" AS ENUM (
  'plan_template',
  'subscription',
  'legacy_free_trial',
  'legacy_trial_subscription',
  'legacy_paid_subscription',
  'admin_override',
  'manual'
);
CREATE TYPE "AttemptLedgerAction" AS ENUM (
  'attempt_consumed',
  'daily_blocked',
  'total_blocked',
  'denied_no_entitlement',
  'manual_adjust',
  'timezone_changed',
  'status_changed',
  'backfill'
);

-- Users timezone fields
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Almaty',
  ADD COLUMN IF NOT EXISTS "timezone_changed_at" TIMESTAMPTZ;

-- Plan templates
CREATE TABLE "subscription_plan_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_premium" BOOLEAN NOT NULL DEFAULT false,
  "duration_days" INTEGER,
  "total_attempts_limit" INTEGER,
  "daily_attempts_limit" INTEGER,
  "timezone_mode" VARCHAR(16) NOT NULL DEFAULT 'user',
  "metadata" JSONB,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_plan_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plan_templates_code_key"
  ON "subscription_plan_templates" ("code");
CREATE INDEX "subscription_plan_templates_is_active_idx"
  ON "subscription_plan_templates" ("is_active");

ALTER TABLE "subscription_plan_templates"
  ADD CONSTRAINT "subscription_plan_templates_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Plan template per-exam rules
CREATE TABLE "subscription_plan_template_exam_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_template_id" UUID NOT NULL,
  "exam_type_id" UUID NOT NULL,
  "total_attempts_limit" INTEGER,
  "daily_attempts_limit" INTEGER,
  "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_plan_template_exam_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plan_template_exam_rules_plan_exam_key"
  ON "subscription_plan_template_exam_rules" ("plan_template_id", "exam_type_id");
CREATE INDEX "subscription_plan_template_exam_rules_exam_type_idx"
  ON "subscription_plan_template_exam_rules" ("exam_type_id");

ALTER TABLE "subscription_plan_template_exam_rules"
  ADD CONSTRAINT "subscription_plan_template_exam_rules_plan_template_fkey"
  FOREIGN KEY ("plan_template_id") REFERENCES "subscription_plan_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_plan_template_exam_rules"
  ADD CONSTRAINT "subscription_plan_template_exam_rules_exam_type_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- User entitlements per exam
CREATE TABLE "user_exam_entitlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exam_type_id" UUID NOT NULL,
  "tier" "EntitlementTier" NOT NULL,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'active',
  "source_type" "EntitlementSourceType" NOT NULL,
  "source_ref" VARCHAR(120),
  "plan_template_id" UUID,
  "subscription_id" UUID,
  "total_attempts_limit" INTEGER,
  "daily_attempts_limit" INTEGER,
  "used_attempts_total" INTEGER NOT NULL DEFAULT 0,
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Almaty',
  "timezone_locked_until" TIMESTAMPTZ,
  "window_starts_at" TIMESTAMPTZ NOT NULL,
  "window_ends_at" TIMESTAMPTZ,
  "next_allowed_at" TIMESTAMPTZ,
  "last_attempt_at" TIMESTAMPTZ,
  "exhausted_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "created_by" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_exam_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_exam_entitlements_source_key"
  ON "user_exam_entitlements" ("source_type", "source_ref");
CREATE INDEX "user_exam_entitlements_user_exam_status_idx"
  ON "user_exam_entitlements" ("user_id", "exam_type_id", "status");
CREATE INDEX "user_exam_entitlements_window_idx"
  ON "user_exam_entitlements" ("window_starts_at", "window_ends_at");
CREATE INDEX "user_exam_entitlements_tier_status_idx"
  ON "user_exam_entitlements" ("tier", "status");

ALTER TABLE "user_exam_entitlements"
  ADD CONSTRAINT "user_exam_entitlements_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_exam_entitlements"
  ADD CONSTRAINT "user_exam_entitlements_exam_type_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_exam_entitlements"
  ADD CONSTRAINT "user_exam_entitlements_plan_template_fkey"
  FOREIGN KEY ("plan_template_id") REFERENCES "subscription_plan_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_exam_entitlements"
  ADD CONSTRAINT "user_exam_entitlements_subscription_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_exam_entitlements"
  ADD CONSTRAINT "user_exam_entitlements_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Daily usage
CREATE TABLE "user_exam_daily_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exam_type_id" UUID NOT NULL,
  "entitlement_id" UUID NOT NULL,
  "local_day" VARCHAR(10) NOT NULL,
  "attempts_used" INTEGER NOT NULL DEFAULT 0,
  "timezone" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_exam_daily_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_exam_daily_usage_entitlement_day_key"
  ON "user_exam_daily_usage" ("entitlement_id", "local_day");
CREATE INDEX "user_exam_daily_usage_user_exam_day_idx"
  ON "user_exam_daily_usage" ("user_id", "exam_type_id", "local_day");

ALTER TABLE "user_exam_daily_usage"
  ADD CONSTRAINT "user_exam_daily_usage_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_exam_daily_usage"
  ADD CONSTRAINT "user_exam_daily_usage_exam_type_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_exam_daily_usage"
  ADD CONSTRAINT "user_exam_daily_usage_entitlement_fkey"
  FOREIGN KEY ("entitlement_id") REFERENCES "user_exam_entitlements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutable usage ledger
CREATE TABLE "attempt_usage_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exam_type_id" UUID NOT NULL,
  "entitlement_id" UUID,
  "session_id" UUID,
  "action" "AttemptLedgerAction" NOT NULL,
  "reason_code" VARCHAR(64),
  "attempts_delta" INTEGER NOT NULL DEFAULT 0,
  "local_day" VARCHAR(10),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempt_usage_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attempt_usage_ledger_user_exam_created_idx"
  ON "attempt_usage_ledger" ("user_id", "exam_type_id", "created_at");
CREATE INDEX "attempt_usage_ledger_entitlement_created_idx"
  ON "attempt_usage_ledger" ("entitlement_id", "created_at");
CREATE INDEX "attempt_usage_ledger_reason_idx"
  ON "attempt_usage_ledger" ("reason_code");

ALTER TABLE "attempt_usage_ledger"
  ADD CONSTRAINT "attempt_usage_ledger_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_usage_ledger"
  ADD CONSTRAINT "attempt_usage_ledger_exam_type_fkey"
  FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_usage_ledger"
  ADD CONSTRAINT "attempt_usage_ledger_entitlement_fkey"
  FOREIGN KEY ("entitlement_id") REFERENCES "user_exam_entitlements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attempt_usage_ledger"
  ADD CONSTRAINT "attempt_usage_ledger_session_fkey"
  FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
