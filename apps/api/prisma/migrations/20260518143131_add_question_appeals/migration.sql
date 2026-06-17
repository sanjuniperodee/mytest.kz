-- CreateEnum
CREATE TYPE "QuestionAppealReason" AS ENUM (
    'incorrect_answer',
    'ambiguous_wording',
    'outdated_content',
    'broken_media',
    'other'
);

-- CreateEnum
CREATE TYPE "QuestionAppealStatus" AS ENUM (
    'pending',
    'under_review',
    'resolved',
    'rejected'
);

-- CreateTable
CREATE TABLE "question_appeals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "exam_type_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "reason" "QuestionAppealReason" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "QuestionAppealStatus" NOT NULL DEFAULT 'pending',
    "question_snapshot" JSONB,
    "admin_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "question_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_appeals_user_id_session_id_question_id_key" ON "question_appeals"("user_id", "session_id", "question_id");

-- CreateIndex
CREATE INDEX "question_appeals_session_id_created_at_idx" ON "question_appeals"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "question_appeals_question_id_created_at_idx" ON "question_appeals"("question_id", "created_at");

-- CreateIndex
CREATE INDEX "question_appeals_status_created_at_idx" ON "question_appeals"("status", "created_at");

-- CreateIndex
CREATE INDEX "question_appeals_exam_type_id_subject_id_status_idx" ON "question_appeals"("exam_type_id", "subject_id", "status");

-- CreateIndex
CREATE INDEX "question_appeals_reviewed_by_reviewed_at_idx" ON "question_appeals"("reviewed_by", "reviewed_at");

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_exam_type_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_appeals" ADD CONSTRAINT "question_appeals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
