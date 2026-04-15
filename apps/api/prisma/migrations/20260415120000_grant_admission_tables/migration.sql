-- CreateEnum
CREATE TYPE "GrantQuotaType" AS ENUM ('GRANT', 'RURAL');

-- CreateTable
CREATE TABLE "universities" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" VARCHAR(200),

    CONSTRAINT "universities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ent_educational_programs" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "profile_variant" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "profile_subjects" TEXT NOT NULL,
    "profile_short_label" VARCHAR(100),

    CONSTRAINT "ent_educational_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_admission_cycles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(32) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_admission_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_cutoffs" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "university_code" INTEGER NOT NULL,
    "program_id" UUID NOT NULL,
    "quota_type" "GrantQuotaType" NOT NULL,
    "min_score" INTEGER,

    CONSTRAINT "grant_cutoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ent_educational_programs_code_profile_variant_key" ON "ent_educational_programs"("code", "profile_variant");

-- CreateIndex
CREATE INDEX "ent_educational_programs_code_idx" ON "ent_educational_programs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "grant_admission_cycles_slug_key" ON "grant_admission_cycles"("slug");

-- CreateIndex
CREATE INDEX "grant_cutoffs_cycle_id_university_code_idx" ON "grant_cutoffs"("cycle_id", "university_code");

-- CreateIndex
CREATE INDEX "grant_cutoffs_cycle_id_program_id_idx" ON "grant_cutoffs"("cycle_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "grant_cutoffs_cycle_id_university_code_program_id_quota_type_key" ON "grant_cutoffs"("cycle_id", "university_code", "program_id", "quota_type");

-- AddForeignKey
ALTER TABLE "grant_cutoffs" ADD CONSTRAINT "grant_cutoffs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "grant_admission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_cutoffs" ADD CONSTRAINT "grant_cutoffs_university_code_fkey" FOREIGN KEY ("university_code") REFERENCES "universities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_cutoffs" ADD CONSTRAINT "grant_cutoffs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "ent_educational_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
