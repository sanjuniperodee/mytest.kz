-- CreateTable
CREATE TABLE "ai_topic_lessons" (
    "id" UUID NOT NULL,
    "exam_type_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "lesson_version" VARCHAR(16) NOT NULL,
    "model" VARCHAR(40) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_topic_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_topic_lessons_exam_type_id_language_idx" ON "ai_topic_lessons"("exam_type_id", "language");

-- CreateIndex
CREATE INDEX "ai_topic_lessons_subject_id_language_idx" ON "ai_topic_lessons"("subject_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ai_topic_lessons_topic_id_language_lesson_version_key" ON "ai_topic_lessons"("topic_id", "language", "lesson_version");

-- AddForeignKey
ALTER TABLE "ai_topic_lessons" ADD CONSTRAINT "ai_topic_lessons_exam_type_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_topic_lessons" ADD CONSTRAINT "ai_topic_lessons_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_topic_lessons" ADD CONSTRAINT "ai_topic_lessons_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
