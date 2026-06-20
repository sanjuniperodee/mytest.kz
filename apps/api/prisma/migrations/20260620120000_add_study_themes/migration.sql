-- CreateTable
CREATE TABLE "subject_study_themes" (
    "id" UUID NOT NULL,
    "exam_type_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subject_study_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_theme_classifications" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "theme_id" UUID,
    "model" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "question_theme_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_theme_lessons" (
    "id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "language" VARCHAR(2) NOT NULL,
    "lesson_version" VARCHAR(16) NOT NULL,
    "model" VARCHAR(40) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subject_theme_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_study_themes_subject_id_is_active_sort_order_idx" ON "subject_study_themes"("subject_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "subject_study_themes_subject_id_key_key" ON "subject_study_themes"("subject_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "question_theme_classifications_question_id_key" ON "question_theme_classifications"("question_id");

-- CreateIndex
CREATE INDEX "question_theme_classifications_subject_id_theme_id_idx" ON "question_theme_classifications"("subject_id", "theme_id");

-- CreateIndex
CREATE INDEX "question_theme_classifications_theme_id_idx" ON "question_theme_classifications"("theme_id");

-- CreateIndex
CREATE INDEX "subject_theme_lessons_subject_id_language_idx" ON "subject_theme_lessons"("subject_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "subject_theme_lessons_theme_id_language_lesson_version_key" ON "subject_theme_lessons"("theme_id", "language", "lesson_version");

-- AddForeignKey
ALTER TABLE "subject_study_themes" ADD CONSTRAINT "subject_study_themes_exam_type_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_study_themes" ADD CONSTRAINT "subject_study_themes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_theme_classifications" ADD CONSTRAINT "question_theme_classifications_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_theme_classifications" ADD CONSTRAINT "question_theme_classifications_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_theme_classifications" ADD CONSTRAINT "question_theme_classifications_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "subject_study_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_theme_lessons" ADD CONSTRAINT "subject_theme_lessons_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "subject_study_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_theme_lessons" ADD CONSTRAINT "subject_theme_lessons_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
