ALTER TABLE "ai_coach_analyses" ADD COLUMN "subject_id" UUID;

CREATE INDEX "ai_coach_analyses_user_scope_created_idx"
  ON "ai_coach_analyses"("user_id", "exam_type_id", "subject_id", "created_at");
