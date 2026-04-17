ALTER TABLE "users"
ADD COLUMN "ent_trial_used" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "PaymentOrderStatus" AS ENUM ('created', 'pending', 'paid', 'failed', 'cancelled');

CREATE TABLE "payment_orders" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "plan_code" VARCHAR(32) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'KZT',
  "provider" VARCHAR(32) NOT NULL DEFAULT 'freedompay',
  "provider_order_id" VARCHAR(120) NOT NULL,
  "provider_payment_id" VARCHAR(120),
  "checkout_url" TEXT,
  "status" "PaymentOrderStatus" NOT NULL DEFAULT 'created',
  "provider_payload" JSONB,
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_orders_provider_order_id_key" ON "payment_orders"("provider_order_id");
CREATE INDEX "payment_orders_user_id_status_created_at_idx" ON "payment_orders"("user_id", "status", "created_at");

ALTER TABLE "payment_orders"
ADD CONSTRAINT "payment_orders_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
