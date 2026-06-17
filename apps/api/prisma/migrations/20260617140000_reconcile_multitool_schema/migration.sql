-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "LeadNotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- DropForeignKey
ALTER TABLE "funnel_steps" DROP CONSTRAINT "funnel_steps_session_id_fkey";

-- DropForeignKey
ALTER TABLE "funnel_steps" DROP CONSTRAINT "funnel_steps_visit_id_fkey";

-- DropForeignKey
ALTER TABLE "test_sessions" DROP CONSTRAINT "test_sessions_visit_id_fkey";

-- DropForeignKey
ALTER TABLE "visit_events" DROP CONSTRAINT "visit_events_user_id_fkey";

-- DropIndex
DROP INDEX "programs_name_trgm_idx";

-- DropIndex
DROP INDEX "programs_profile_subjects_trgm_idx";

-- DropIndex
DROP INDEX "subscription_plan_templates_is_active_idx";

-- AlterTable
ALTER TABLE "attempt_usage_ledger" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_deliveries" ADD COLUMN     "next_attempt_at" TIMESTAMPTZ,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscription_plan_template_exam_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subscription_plan_templates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "payment_order_id" UUID;

-- AlterTable
ALTER TABLE "user_exam_daily_usage" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_exam_entitlements" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifications_muted_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "payment_order_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_refund_id" VARCHAR(120),
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'KZT',
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "provider_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "message" TEXT,
    "source" VARCHAR(60) NOT NULL DEFAULT 'landing',
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "notification_status" "LeadNotificationStatus" NOT NULL DEFAULT 'pending',
    "notification_error" TEXT,
    "notified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audits" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(100),
    "action" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_payment_order_id_key" ON "payment_refunds"("payment_order_id");

-- CreateIndex
CREATE INDEX "payment_refunds_provider_status_requested_idx" ON "payment_refunds"("provider", "status", "requested_at");

-- CreateIndex
CREATE INDEX "leads_created_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_notification_status_created_idx" ON "leads"("notification_status", "created_at");

-- CreateIndex
CREATE INDEX "admin_audits_actor_user_id_created_at_idx" ON "admin_audits"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audits_target_type_target_id_idx" ON "admin_audits"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "questions_metadata_idx" ON "questions" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "subscriptions_payment_order_idx" ON "subscriptions"("payment_order_id");

-- CreateIndex
CREATE INDEX "test_sessions_user_id_started_at_idx" ON "test_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "test_sessions_status_finished_at_idx" ON "test_sessions"("status", "finished_at");

-- RenameForeignKey
ALTER TABLE "attempt_usage_ledger" RENAME CONSTRAINT "attempt_usage_ledger_entitlement_fkey" TO "attempt_usage_ledger_entitlement_id_fkey";

-- RenameForeignKey
ALTER TABLE "attempt_usage_ledger" RENAME CONSTRAINT "attempt_usage_ledger_exam_type_fkey" TO "attempt_usage_ledger_exam_type_id_fkey";

-- RenameForeignKey
ALTER TABLE "attempt_usage_ledger" RENAME CONSTRAINT "attempt_usage_ledger_session_fkey" TO "attempt_usage_ledger_session_id_fkey";

-- RenameForeignKey
ALTER TABLE "attempt_usage_ledger" RENAME CONSTRAINT "attempt_usage_ledger_user_fkey" TO "attempt_usage_ledger_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "subscription_plan_template_exam_rules" RENAME CONSTRAINT "subscription_plan_template_exam_rules_exam_type_fkey" TO "subscription_plan_template_exam_rules_exam_type_id_fkey";

-- RenameForeignKey
ALTER TABLE "subscription_plan_template_exam_rules" RENAME CONSTRAINT "subscription_plan_template_exam_rules_plan_template_fkey" TO "subscription_plan_template_exam_rules_plan_template_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_daily_usage" RENAME CONSTRAINT "user_exam_daily_usage_entitlement_fkey" TO "user_exam_daily_usage_entitlement_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_daily_usage" RENAME CONSTRAINT "user_exam_daily_usage_exam_type_fkey" TO "user_exam_daily_usage_exam_type_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_daily_usage" RENAME CONSTRAINT "user_exam_daily_usage_user_fkey" TO "user_exam_daily_usage_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_entitlements" RENAME CONSTRAINT "user_exam_entitlements_exam_type_fkey" TO "user_exam_entitlements_exam_type_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_entitlements" RENAME CONSTRAINT "user_exam_entitlements_plan_template_fkey" TO "user_exam_entitlements_plan_template_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_entitlements" RENAME CONSTRAINT "user_exam_entitlements_subscription_fkey" TO "user_exam_entitlements_subscription_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_exam_entitlements" RENAME CONSTRAINT "user_exam_entitlements_user_fkey" TO "user_exam_entitlements_user_id_fkey";

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audits" ADD CONSTRAINT "admin_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "attempt_usage_ledger_entitlement_created_idx" RENAME TO "attempt_usage_ledger_entitlement_id_created_at_idx";

-- RenameIndex
ALTER INDEX "attempt_usage_ledger_reason_idx" RENAME TO "attempt_usage_ledger_reason_code_idx";

-- RenameIndex
ALTER INDEX "attempt_usage_ledger_user_exam_created_idx" RENAME TO "attempt_usage_ledger_user_id_exam_type_id_created_at_idx";

-- RenameIndex
ALTER INDEX "subscription_plan_template_exam_rules_exam_type_idx" RENAME TO "subscription_plan_template_exam_rules_exam_type_id_idx";

-- RenameIndex
ALTER INDEX "subscription_plan_template_exam_rules_plan_exam_key" RENAME TO "subscription_plan_template_exam_rules_plan_template_id_exam_key";

-- RenameIndex
ALTER INDEX "user_exam_daily_usage_entitlement_day_key" RENAME TO "user_exam_daily_usage_entitlement_id_local_day_key";

-- RenameIndex
ALTER INDEX "user_exam_daily_usage_user_exam_day_idx" RENAME TO "user_exam_daily_usage_user_id_exam_type_id_local_day_idx";

-- RenameIndex
ALTER INDEX "user_exam_entitlements_source_key" RENAME TO "user_exam_entitlements_source_type_source_ref_key";

-- RenameIndex
ALTER INDEX "user_exam_entitlements_window_idx" RENAME TO "user_exam_entitlements_window_starts_at_window_ends_at_idx";


-- CHECK constraints (not expressible in Prisma schema; from add_test_sessions_score_checks).
-- Verified: 0 existing test_sessions rows violate these.
ALTER TABLE "test_sessions"
  ADD CONSTRAINT "test_sessions_score_range" CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  ADD CONSTRAINT "test_sessions_raw_score_nonneg" CHECK (raw_score IS NULL OR raw_score >= 0),
  ADD CONSTRAINT "test_sessions_max_score_nonneg" CHECK (max_score IS NULL OR max_score >= 0);
