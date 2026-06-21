-- CreateEnum
CREATE TYPE "AiLessonNoteReason" AS ENUM (
    'wrong_topic',
    'incorrect_explanation',
    'unclear_explanation',
    'typo',
    'outdated_content',
    'other'
);

-- CreateEnum
CREATE TYPE "AiLessonNoteStatus" AS ENUM (
    'pending',
    'under_review',
    'resolved',
    'rejected'
);

-- CreateTable
CREATE TABLE "ai_lesson_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme_lesson_id" UUID,
    "topic_lesson_id" UUID,
    "exam_type_id" UUID,
    "subject_id" UUID,
    "theme_id" UUID,
    "topic_id" UUID,
    "language" VARCHAR(2) NOT NULL,
    "lesson_version" VARCHAR(16) NOT NULL,
    "reason" "AiLessonNoteReason" NOT NULL DEFAULT 'other',
    "message" TEXT NOT NULL,
    "status" "AiLessonNoteStatus" NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_lesson_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_lesson_notes_theme_lesson_id_status_created_at_idx" ON "ai_lesson_notes"("theme_lesson_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_lesson_notes_topic_lesson_id_status_created_at_idx" ON "ai_lesson_notes"("topic_lesson_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_lesson_notes_user_id_created_at_idx" ON "ai_lesson_notes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_lesson_notes_subject_id_status_created_at_idx" ON "ai_lesson_notes"("subject_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_lesson_notes_status_created_at_idx" ON "ai_lesson_notes"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_lesson_notes_reviewed_by_reviewed_at_idx" ON "ai_lesson_notes"("reviewed_by", "reviewed_at");

-- AddForeignKey
ALTER TABLE "ai_lesson_notes" ADD CONSTRAINT "ai_lesson_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_lesson_notes" ADD CONSTRAINT "ai_lesson_notes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_lesson_notes" ADD CONSTRAINT "ai_lesson_notes_theme_lesson_id_fkey" FOREIGN KEY ("theme_lesson_id") REFERENCES "subject_theme_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_lesson_notes" ADD CONSTRAINT "ai_lesson_notes_topic_lesson_id_fkey" FOREIGN KEY ("topic_lesson_id") REFERENCES "ai_topic_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
