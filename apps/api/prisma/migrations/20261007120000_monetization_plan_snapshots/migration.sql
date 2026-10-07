-- Centralized monetization: plan terms are snapshotted on orders/subscriptions,
-- and the free daily ENT allowance gets its own entitlement source.
-- Additive only: nullable columns + a new enum value.

-- AlterEnum
ALTER TYPE "EntitlementSourceType" ADD VALUE 'free_daily';

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN "plan_snapshot" JSONB;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "plan_snapshot" JSONB;
