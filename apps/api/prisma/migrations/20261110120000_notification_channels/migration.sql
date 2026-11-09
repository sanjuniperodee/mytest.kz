-- Re-engagement channels: email + web push next to Telegram. Additive only.

-- Users: Telegram linked from an existing web account (reminders only) and email opt-out.
ALTER TABLE "users" ADD COLUMN "telegram_linked_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "email_opt_out_at" TIMESTAMPTZ;

-- Web Push subscriptions (one row per browser endpoint).
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_success_at" TIMESTAMPTZ,
    "last_failure_at" TIMESTAMPTZ,
    "failure_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_created_at_idx" ON "push_subscriptions"("user_id", "created_at");

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deliveries become channel-aware. Existing rows are Telegram deliveries.
ALTER TABLE "notification_deliveries" ADD COLUMN "channel" VARCHAR(16) NOT NULL DEFAULT 'telegram';
ALTER TABLE "notification_deliveries" ALTER COLUMN "target_telegram_id" DROP NOT NULL;
ALTER TABLE "notification_deliveries" ADD COLUMN "target_email" VARCHAR(255);
ALTER TABLE "notification_deliveries" ADD COLUMN "target_push_id" UUID;

CREATE INDEX "notification_deliveries_campaign_channel_status_idx" ON "notification_deliveries"("campaign_key", "channel", "status");

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_target_push_id_fkey" FOREIGN KEY ("target_push_id") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
