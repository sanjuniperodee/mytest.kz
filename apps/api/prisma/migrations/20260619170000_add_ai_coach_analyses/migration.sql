-- CreateTable
CREATE TABLE "ai_coach_analyses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exam_type_id" UUID,
    "scope_hash" VARCHAR(64) NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "model" VARCHAR(40) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_coach_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_coach_analyses_user_id_created_at_idx" ON "ai_coach_analyses"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_coach_analyses_user_id_scope_hash_key" ON "ai_coach_analyses"("user_id", "scope_hash");

-- AddForeignKey
ALTER TABLE "ai_coach_analyses" ADD CONSTRAINT "ai_coach_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
