-- Kazakh names for the grant-admission reference (universities, program groups, profile subjects).
-- Additive: nullable columns only; the API falls back to the Russian name when they are empty.

-- AlterTable
ALTER TABLE "universities" ADD COLUMN "name_kk" TEXT;

-- AlterTable
ALTER TABLE "ent_educational_programs" ADD COLUMN "name_kk" TEXT,
ADD COLUMN "profile_subjects_kk" TEXT;
