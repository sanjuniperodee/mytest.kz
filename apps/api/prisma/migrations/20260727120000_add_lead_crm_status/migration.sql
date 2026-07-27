-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'converted', 'closed');

-- AlterTable
ALTER TABLE "leads"
ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'new',
ADD COLUMN "admin_note" TEXT,
ADD COLUMN "contacted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "leads_status_created_idx" ON "leads"("status", "created_at");
