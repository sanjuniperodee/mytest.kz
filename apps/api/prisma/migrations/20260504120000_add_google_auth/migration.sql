ALTER TABLE "users" ALTER COLUMN "telegram_id" DROP NOT NULL;

ALTER TABLE "users"
  ADD COLUMN "google_id" VARCHAR(255),
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
