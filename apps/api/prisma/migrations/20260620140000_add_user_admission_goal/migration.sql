-- CreateTable
CREATE TABLE "user_admission_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cycle_slug" VARCHAR(32) NOT NULL,
    "university_code" INTEGER NOT NULL,
    "program_id" UUID NOT NULL,
    "quota_type" "GrantQuotaType" NOT NULL DEFAULT 'GRANT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_admission_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_admission_goals_user_id_key" ON "user_admission_goals"("user_id");

-- AddForeignKey
ALTER TABLE "user_admission_goals" ADD CONSTRAINT "user_admission_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
