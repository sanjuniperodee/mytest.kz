-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);

-- Unique when set (multiple NULLs allowed)
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
