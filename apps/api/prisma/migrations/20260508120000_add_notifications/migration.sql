-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cooldown_hours" INTEGER NOT NULL DEFAULT 24,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "campaign_key" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "subscription_id" UUID,
    "dedupe_key" VARCHAR(160) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "target_telegram_id" BIGINT NOT NULL,
    "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_runs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'scheduler',
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "notification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_campaigns_key_key" ON "notification_campaigns"("key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_dedupe_key_key" ON "notification_deliveries"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_campaign_key_status_attempted_at_idx" ON "notification_deliveries"("campaign_key", "status", "attempted_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_user_id_sent_at_idx" ON "notification_deliveries"("user_id", "sent_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_session_id_idx" ON "notification_deliveries"("session_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_subscription_id_idx" ON "notification_deliveries"("subscription_id");

-- CreateIndex
CREATE INDEX "notification_runs_started_at_idx" ON "notification_runs"("started_at");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_campaign_key_fkey" FOREIGN KEY ("campaign_key") REFERENCES "notification_campaigns"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
